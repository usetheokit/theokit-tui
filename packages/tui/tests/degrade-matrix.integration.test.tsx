import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { defaultTheme } from "../src/theme/theme.js";

// M6 T3.2 (plan D6): the degrade matrix — THREE spawns of ONE provider-wrapped
// all-primitives fixture. Level changes REQUIRE a fresh subprocess (chalk
// freezes its level at import — the M0 lesson); theme swaps are in-process
// (see public-api.integration.test.tsx). Each spawn carries BOTH timeout
// layers + minimal env (house rule, M0 review F-tests-5).

const PROBE = "tests/fixtures/no-color-probe.tsx";

function spawnProbe(extraEnv: Record<string, string>): string {
  return execFileSync("pnpm", ["exec", "tsx", PROBE], {
    encoding: "utf8",
    // Kills the child at the deadline — the it-level timeout cannot interrupt a synchronous
    // execFileSync, which is why this file carries BOTH layers.
    //
    // B-034 — 60000 ms, measured rather than guessed. One spawn costs 2621 ms at load 12.99
    // (`no_color_scene_degrades_readably`, one spawn; the two-spawn scene measured 5160 ms). The
    // previous budget of 20000 ms was a 7.6x margin on that and STILL failed with
    // `spawnSync pnpm ETIMEDOUT` at load ~30.
    //
    // The cost is not what the test asserts: this runs `pnpm exec tsx`, i.e. package resolution
    // plus a TypeScript compile, three times per suite run. Pre-compiling the probe and spawning
    // `node` would take it to ~100 ms and remove the sensitivity instead of budgeting for it —
    // that is the better fix and it is deferred as B-034 Q2, not overlooked.
    timeout: 60000,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      ...extraEnv,
    },
  });
}

/** The shared degrade assertions — every scene must keep MEANING without
 * color: glyphs, labels and signs are the color-independent channel. */
function assertDegradedScene(out: string): void {
  expect(out).not.toContain("\u001b[");
  // The theme's own token — the assertion is that the glyph channel SURVIVES without colour, not
  // that it is any particular character (#62 item 3 changed it).
  expect(out).toContain(defaultTheme.role.user.glyph.trim());
  expect(out).toContain("plain text probe");
  // M9: banner name + hint readable in every degraded scene (theme-agnostic;
  // the border GLYPH is asserted per scene — the policy is theme-DATA-driven,
  // plan EC-3).
  expect(out).toContain("Probe");
  expect(out).toContain("hint row");
  // M1: all three role glyphs distinguishable without color.
  expect(out).toContain("·");
  expect(out).toContain("⏺");
  expect(out).toContain("degraded but readable");
  // M2: tool statuses + shell envelope — the stderr LABEL is the mechanism.
  expect(out).toContain("⏺");
  expect(out).toContain("OkTool");
  expect(out).toMatch(/^⏺\s+QueuedTool/m);
  expect(out).toMatch(/^⏺\s+BrokenTool/m);
  expect(out).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+RunningTool/mu);
  expect(out).toContain("stderr:");
  expect(out).toContain("exited 2");
  // M3: thinking + streaming readable without color.
  expect(out).toMatch(/^•\s+inspecting the failing test/m);
  expect(out).toContain("agent turn");
  expect(out).toContain("(12s · esc to interrupt)");
  // M4: diff signs + fold indicator (the sign column is THE mechanism).
  expect(out).toMatch(/^\s*\d+ \+ new probe line/m);
  expect(out).toMatch(/^\s*\d+ - old probe line/m);
  expect(out).toContain("lines hidden");
  // M5: glyph-distinct fill (filled vs empty are DIFFERENT characters).
  expect(out).toContain("█");
  expect(out).toContain("░");
  expect(out).toMatch(/\d+% left/);
  expect(out).toContain("~$");
  // M6: CodeBlock text present (text-only assert — lowlight resolves in the
  // subprocess; the plain frame is a load race, NOT the absent path).
  expect(out).toContain("const scene = true;");
  // M6: composer placeholder readable.
  expect(out).toContain("type here");
}

describe("degrade matrix (M6 T3.2, plan D6)", () => {
  it("no_color_scene_degrades_readably", { timeout: 90000 }, () => {
    const out = spawnProbe({ NO_COLOR: "1" });
    assertDegradedScene(out);
    // M10 pipe contract (blueprint Corner 4): ink7 non-interactive writes
    // ONE final frame at unmount — the probe content appears exactly once
    // (ink5 pipes wrote N throttled intermediate frames).
    const occurrences = out.split("plain text probe").length - 1;
    expect(occurrences).toBe(1);
    // The ▏ cursor marker is the only-OUR-swap-can-produce oracle (EC-2):
    // it renders exclusively under the no-color THEME, which only the
    // provider's NO_COLOR resolution selects here.
    expect(out).toContain("▏");
    // M9 EC-3: ONLY this scene resolves the no-color THEME → single border.
    expect(out).toContain("┌");
    expect(out).not.toContain("╭");
  });

  // TWO sequential spawns, each with its own 20s deadline — so the it-level budget must exceed
  // the worst case (review dom-testing-3; house subprocess-flake history under load).
  it("term_dumb_scene_matches_no_color_bytes_modulo_marker", { timeout: 150000 }, () => {
    // TERM=dumb resolves the DARK theme at chalk level 0 — no marker by
    // design (EC-1); the composer cursor cell is the inverse-stripped
    // space, so the normalization maps marker → space.
    const outDumb = spawnProbe({ TERM: "dumb" });
    assertDegradedScene(outDumb);
    expect(outDumb).not.toContain("▏");
    // M9 EC-3: dumb resolves the DARK theme at level 0 → round border.
    expect(outDumb).toContain("╭");
    expect(outDumb).not.toContain("┌");
    const outNoColor = spawnProbe({ NO_COLOR: "1" });
    // Exactly ONE marker (review tests-3 — a duplicated-marker regression
    // must not hide inside the global replaceAll wherever dumb has spaces).
    expect(outNoColor.split("▏")).toHaveLength(2);
    // M9 EC-3: the banner border differs BY DESIGN between the scenes
    // (dark→round vs no-color→single) — normalize the 4 corner glyphs
    // alongside the marker (─/│ are shared between round and single).
    // M10: with ink7's single-final-frame pipe contract, the running
    // spinner's PHASE at unmount is process-timing-dependent — the two
    // spawns may freeze different dots glyphs. The phase was never the
    // oracle; normalize all cli-spinners dots glyphs on BOTH sides.
    const SPINNER = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g;
    const outDumbNorm = outDumb.replace(SPINNER, "⠿");
    const normalized = outNoColor
      .replace(SPINNER, "⠿")
      .replaceAll("▏", " ")
      .replaceAll("┌", "╭")
      .replaceAll("┐", "╮")
      .replaceAll("└", "╰")
      .replaceAll("┘", "╯");
    expect(outDumbNorm).toBe(normalized);
  });

  it("bare_pipe_degrades_without_env", { timeout: 90000 }, () => {
    // NO color env at all — the pipe itself forces chalk level 0
    // (non-TTY → 0 when FORCE_COLOR is unset): detection proves itself.
    const out = spawnProbe({});
    assertDegradedScene(out);
    // M9 EC-3: bare pipe also resolves the DARK theme → round border.
    expect(out).toContain("╭");
    expect(out).not.toContain("┌");
  });

  it("chalk_downsample_canary", { timeout: 90000 }, () => {
    // EC-4 residual guard: pins the INSTALLED chalk's hex→256 rounding at
    // level 2 via the deterministic env recipe TERM=dumb + FORCE_COLOR=2
    // (immune to CI-vendor sniffs — GH Actions forces level 3 otherwise).
    // A chalk bump that changes rgbToAnsi256 rounding turns THIS red instead
    // of N snapshot diffs. Consumer hex overrides rely on this behavior.
    // Resolution note: ink@5 exposes no "./package.json" export and is
    // ESM-only, so require.resolve cannot reach its chalk. The pnpm layout
    // (real ink dir and its chalk are SIBLINGS under .pnpm/) is the honest
    // deterministic path to the exact chalk instance ink imports.
    const script = [
      'import { realpathSync } from "node:fs";',
      'import { pathToFileURL } from "node:url";',
      'import { dirname, join } from "node:path";',
      'const realInk = realpathSync("node_modules/ink");',
      'const entry = join(dirname(realInk), "chalk", "source", "index.js");',
      "const { default: chalk } = await import(pathToFileURL(entry).href);",
      'process.stdout.write(JSON.stringify(chalk.hex("#ff8800")("x")));',
    ].join("\n");
    const out = execFileSync("node", ["--input-type=module", "-e", script], {
      encoding: "utf8",
      timeout: 60000,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TERM: "dumb",
        FORCE_COLOR: "2",
      },
    });
    expect(out).toContain("38;5;214");
  });
});
