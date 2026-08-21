import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Box } from "ink";
import { render } from "ink-testing-library";

import { ChatMessage, TheoTUIProvider } from "../src/index.js";
import type { RunMetrics } from "./sampling.js";
import { fmt, frameSampler, round, stackVersions, stats, tick } from "./sampling.js";

// M0 render benchmark (plan T3.1, ADR D6/D9 — data-only, no threshold gate).
// Workload: 100-message static thread + 300-token streaming append into the
// last assistant message. Metrics: frame count + mean/peak ms-per-frame.
// Protocol: 1 discarded warmup + 5 measured runs, mean ± std dev.
const N_MESSAGES = 100;
const N_TOKENS = 300;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

const smoke = process.argv.includes("--smoke");
const loadAtStart = loadavg()[0] ?? -1;

type Mode = "plain" | "markdown";

// M13 markdown mode: the streamed tail is markdown-rich and re-parses on
// every repaint — the per-frame path the M9 flip condition points at. The
// token CADENCE is identical (300 rerenders, same appended tokens) but the
// markdown tail ALSO carries MD_PREFIX — the mode delta therefore measures
// parse + richer content TOGETHER, not the flag in isolation (honest scope,
// review r1-F1).
const MD_PREFIX = "## Reply\n**bold** step, `code span`\n```ts\nconst x = 1;\n```\n";

function App({ streamed, mode }: { streamed: string; mode: Mode }) {
  const history = Array.from({ length: N_MESSAGES }, (_, i) => (
    <ChatMessage key={i} role={i % 2 === 0 ? "user" : "assistant"}>
      {`message ${i} — the quick brown fox jumps over the lazy dog`}
    </ChatMessage>
  ));
  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        {history}
        <ChatMessage role="assistant" markdown={mode === "markdown"}>
          {mode === "markdown" ? MD_PREFIX + streamed : streamed}
        </ChatMessage>
      </Box>
    </TheoTUIProvider>
  );
}

async function runOnce(mode: Mode): Promise<RunMetrics> {
  // Sampling via shared helpers (review arch-1/dom-testing-2 migration) —
  // identical frame-delta heuristic as the original inline loop.
  const instance = render(<App streamed="" mode={mode} />);
  await tick();
  const sampler = frameSampler(() => instance.frames.length);
  let text = "";

  for (let i = 0; i < N_TOKENS; i++) {
    text += "tok ";
    instance.rerender(<App streamed={text} mode={mode} />);
    await tick();
    sampler.sample();
  }
  instance.unmount();
  return sampler.finish();
}

console.log(
  `chat-message bench — ${N_MESSAGES} messages + ${N_TOKENS} streamed tokens` +
    (smoke ? " [SMOKE: 1 run, no file write]" : ""),
);

const measured = smoke ? 1 : MEASURED_RUNS;
const aggregate = (modeRuns: RunMetrics[]) => ({
  frames_mean: round(modeRuns.reduce((a, r) => a + r.frames, 0) / modeRuns.length),
  mean_ms_per_frame: stats(modeRuns.map((r) => r.mean_ms_per_frame)),
  peak_ms_per_frame: stats(modeRuns.map((r) => r.peak_ms_per_frame)),
});

const MODES: Mode[] = smoke ? ["plain"] : ["plain", "markdown"];
const modeResults: { mode: Mode; runs: RunMetrics[] }[] = [];
for (const mode of MODES) {
  for (let i = 0; i < (smoke ? 0 : WARMUP_RUNS); i++) {
    const w = await runOnce(mode);
    console.log(`${fmt(`${mode} warmup`, w)}  (discarded)`);
  }
  const modeRuns: RunMetrics[] = [];
  for (let i = 0; i < measured; i++) {
    const r = await runOnce(mode);
    modeRuns.push(r);
    console.log(fmt(`${mode} #${i + 1}`, r));
  }
  modeResults.push({ mode, runs: modeRuns });
}

// Legacy top-level shape stays = the PLAIN mode (existing baseline
// contract tests keep passing; modes[] is additive).
const runs = modeResults[0]?.runs ?? [];
const aggregatePlain = aggregate(runs);

console.log("=== aggregates ===");
for (const m of modeResults) {
  const agg = aggregate(m.runs);
  console.log(
    `${m.mode.padEnd(9)} mean=${agg.mean_ms_per_frame.mean}±${agg.mean_ms_per_frame.std_dev}ms  peak=${agg.peak_ms_per_frame.mean}±${agg.peak_ms_per_frame.std_dev}ms`,
  );
}

if (!smoke) {
  const baseline = {
    benchmark: "chat-message-render",
    date: new Date().toISOString(),
    node_version: process.version,
    stack: stackVersions(),
    hardware: {
      cpu: cpus()[0]?.model ?? "unknown",
      cores: cpus().length,
    },
    workload: { messages: N_MESSAGES, streamed_tokens: N_TOKENS },
    color_env: { FORCE_COLOR: process.env.FORCE_COLOR ?? "unset" },
    protocol: { warmup_runs: WARMUP_RUNS, measured_runs: measured },
    load_1min_at_start: round(loadAtStart),
    runs,
    aggregate: aggregatePlain,
    modes: modeResults.map((m) => ({
      mode: m.mode,
      runs: m.runs,
      aggregate: aggregate(m.runs),
    })),
    methodology:
      "ink-testing-library render + rerender loop (one event-loop tick between " +
      "rerenders so Ink flushes); per-frame ms = wall time distributed evenly " +
      "across stdout.frames deltas (react-ink heuristic — includes tick " +
      "overhead, not true per-frame instrumentation); color env pinned by " +
      "benchmarks/run.ts (FORCE_COLOR=1); 1 discarded warmup + N measured runs; " +
      "std_dev is population std dev over run-level means. M13: modes[] " +
      "adds a markdown mode (identical token cadence; the tail message " +
      "carries a markdown-rich prefix and the markdown flag — parse runs " +
      "per repaint); top-level runs/aggregate REMAIN the plain mode " +
      "(baseline-contract compatibility).",
  };
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "baselines",
    "chat-message-baseline.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`baseline written: benchmarks/baselines/chat-message-baseline.json`);
}
