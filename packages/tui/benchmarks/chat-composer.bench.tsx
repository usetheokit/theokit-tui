import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "ink-testing-library";

import { ChatComposer, TheoTUIProvider } from "../src/index.js";
import type { RunMetrics } from "./sampling.js";
import { fmt, frameSampler, round, stackVersions, stats } from "./sampling.js";

// M15 chat-composer benchmark (plan T3.1, ADR D4): typing with the menu
// open recomputes filter+window per keystroke — a per-frame path (M9 flip
// condition). Modes:
//   menu  — scripted stdin keystrokes with 50 commands registered (the
//           menu derives + renders on every key).
//   plain — the SAME keystrokes with no `commands` prop (the pre-M15
//           composer cost).
const N_COMMANDS = 50;
const KEYSTROKES = 120;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

const smoke = process.argv.includes("--smoke");
const loadAtStart = loadavg()[0] ?? -1;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const COMMANDS = Array.from({ length: N_COMMANDS }, (_, i) => ({
  name: `command-${i}`,
  description: `does the number ${i} thing`,
}));

// The script STRICTLY alternates typing "c" and erasing it (DEL 0x7f) so
// the filter oscillates between "c" and "" — every command-N name matches
// BOTH, so the menu is OPEN with all 50 rows on EVERY keystroke (review
// F-1: the first draft let the filter drift to "cc" — zero matches — and
// silently benched a mostly-closed menu).
const SCRIPT: string[] = ["/"];
for (let i = SCRIPT.length; i < KEYSTROKES; i++) {
  SCRIPT.push(i % 2 === 0 ? "" : "c");
}

type Mode = "menu" | "plain";

async function runOnce(mode: Mode): Promise<RunMetrics> {
  const instance = render(
    <TheoTUIProvider>
      <ChatComposer onSubmit={() => {}} {...(mode === "menu" ? { commands: COMMANDS } : {})} />
    </TheoTUIProvider>,
  );
  // 100 ms mount settle: a cold-start 10 ms window silently DROPPED the
  // leading "/" (review r2-F5) — fail-fast guard below backs this up.
  await sleep(100);
  const sampler = frameSampler(() => instance.frames.length);
  const framesAtMount = instance.frames.length;
  for (const key of SCRIPT) {
    instance.stdin.write(key);
    await sleep(0);
    sampler.sample();
  }
  const framesAfter = instance.frames.length;
  const lastFrame = instance.lastFrame() ?? "";
  instance.unmount();
  if (framesAfter <= framesAtMount) {
    throw new Error("bench: keystrokes produced no frames");
  }
  // Fail-fast (r2-F5): the menu mode MUST have an open menu at the end of
  // the script (filter oscillates c/empty — rows always visible); a
  // dropped "/" would silently bench a menuless composer.
  if (mode === "menu" && !lastFrame.includes("command-")) {
    throw new Error("bench: menu mode ended with no visible menu rows");
  }
  return sampler.finish();
}

console.log(
  `chat-composer bench — ${KEYSTROKES} keystrokes, modes menu(${N_COMMANDS} cmds)|plain` +
    (smoke ? " [SMOKE: 1 plain run, no file write]" : ""),
);

const measured = smoke ? 1 : MEASURED_RUNS;
const MODES: Mode[] = smoke ? ["plain"] : ["menu", "plain"];
const results: { mode: Mode; runs: RunMetrics[] }[] = [];
for (const mode of MODES) {
  for (let i = 0; i < (smoke ? 0 : WARMUP_RUNS); i++) {
    const w = await runOnce(mode);
    console.log(`${fmt(`${mode} warmup`, w)}  (discarded)`);
  }
  const runs: RunMetrics[] = [];
  for (let i = 0; i < measured; i++) {
    const r = await runOnce(mode);
    runs.push(r);
    console.log(fmt(`${mode} #${i + 1}`, r));
  }
  results.push({ mode, runs });
}

const aggregate = (runs: RunMetrics[]) => ({
  frames_mean: round(runs.reduce((a, r) => a + r.frames, 0) / runs.length),
  mean_ms_per_frame: stats(runs.map((r) => r.mean_ms_per_frame)),
  peak_ms_per_frame: stats(runs.map((r) => r.peak_ms_per_frame)),
});

console.log("=== aggregates ===");
for (const m of results) {
  const agg = aggregate(m.runs);
  console.log(
    `${m.mode.padEnd(6)} mean=${agg.mean_ms_per_frame.mean}±${agg.mean_ms_per_frame.std_dev}ms  peak=${agg.peak_ms_per_frame.mean}±${agg.peak_ms_per_frame.std_dev}ms`,
  );
}

if (!smoke) {
  const baseline = {
    benchmark: "chat-composer-typing",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: { cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
    color_env: { FORCE_COLOR: process.env.FORCE_COLOR ?? "unset" },
    load_1min_at_start: round(loadAtStart),
    workload: {
      keystrokes: KEYSTROKES,
      commands: N_COMMANDS,
      script: "slash + type/erase filter chars (menu stays open)",
    },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    modes: results.map((m) => ({
      mode: m.mode,
      runs: m.runs,
      aggregate: aggregate(m.runs),
    })),
    methodology:
      "ink-testing-library render; each keystroke written to the fake " +
      "stdin with a 0-tick flush; the script strictly alternates typing/" +
      "erasing one filter char so the menu is OPEN with all 50 rows on " +
      "EVERY keystroke (filter oscillates c/empty); menu mode registers " +
      "50 commands so the derive AND the row render run per keystroke; " +
      "plain mode runs the SAME script without the commands prop — the " +
      "mode delta is the menu's per-keystroke cost. Frame-delta sampler; " +
      "FORCE_COLOR=1 via benchmarks/run.ts; 1 warmup + N measured runs " +
      "per mode; population std dev.",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "baselines",
    "composer-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log("baseline written: benchmarks/baselines/composer-baseline.json");
}
