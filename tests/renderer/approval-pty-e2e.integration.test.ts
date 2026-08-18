import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

// M23 T4.1 (plan m23-agent-decision-surfaces): the node-pty e2e for ONE full
// approve flow — the real raw-mode path drives the ApprovalPrompt's ChoiceRow
// (→ moves, Enter commits) and the emitted decision reaches stdout. Skips
// gracefully (never a false green) when node-pty's native module is unavailable.

const here = dirname(fileURLToPath(import.meta.url));
const harness = join(here, "approval-pty-harness.tsx");
const tsx = join(here, "..", "..", "node_modules", ".bin", "tsx");

let pty: typeof import("node-pty") | undefined;
let skipReason = "";
try {
  pty = await import("node-pty");
} catch (error) {
  skipReason = `node-pty native module unavailable: ${(error as Error).message.split("\n")[0]}`;
}

interface Session {
  write: (bytes: string) => void;
  waitFor: (pattern: RegExp, timeoutMs?: number) => Promise<string>;
  output: () => string;
  kill: () => void;
}

function spawnHarness(mod: typeof import("node-pty")): Session {
  const proc = mod.spawn(tsx, [harness], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: join(here, "..", ".."),
    env: process.env as Record<string, string>,
  });
  let buffer = "";
  proc.onData((data) => {
    buffer += data;
  });
  return {
    write: (bytes) => proc.write(bytes),
    output: () => buffer,
    kill: () => {
      try {
        proc.kill();
      } catch {
        /* already exited */
      }
    },
    waitFor: (pattern, timeoutMs = 5000) =>
      new Promise<string>((resolve, reject) => {
        const start = Date.now();
        const tick = (): void => {
          if (pattern.test(buffer)) {
            resolve(buffer);
            return;
          }
          if (Date.now() - start > timeoutMs) {
            reject(
              new Error(`timeout waiting for ${pattern} — got:\n${buffer}`),
            );
            return;
          }
          // duration is the subject: a POLL INTERVAL inside a bounded wait that already rejects
          // with the pattern it never saw. Already the idiom B-033 converts other sites TO.
          setTimeout(tick, 20);
        };
        tick();
      }),
  };
}

const sessions: Session[] = [];
afterAll(() => {
  for (const s of sessions) {
    s.kill();
  }
});

describe.skipIf(!pty)(
  "ApprovalPrompt PTY e2e — full approve flow (M23 T4.1)",
  () => {
    it("drives_the_choice_bar_over_real_raw_mode_and_emits_the_decision", async () => {
      const session = spawnHarness(pty!);
      sessions.push(session);
      // The harness reports isTTY — the REAL raw-mode path (a pipe would be false).
      // A generous READY wait: the tsx subprocess cold-start can exceed 5s under
      // parallel-suite load (testing.md §6 — deterministic, not a fixed sleep).
      const ready = await session.waitFor(/READY tty=(true|false)/, 15000);
      expect(ready).toContain("READY tty=true");

      // The ChoiceRow subscribes to input a couple renders after mount (the focus
      // round-trip), so the very first key can land before it is listening. The
      // digit jump is IDEMPOTENT (key "2" → index 1 = "always"), so retrying it
      // until the marker moves is safe (no overshoot) and deterministic.
      for (let attempt = 0; attempt < 20; attempt += 1) {
        session.write("2"); // jump to the 2nd choice ("always")
        try {
          await session.waitFor(/❯ Allow always/, 300);
          break;
        } catch {
          /* not subscribed yet — retry the idempotent jump */
        }
      }
      expect(session.output()).toContain("❯ Allow always");

      session.write("\r"); // Enter → commit the active choice
      await session.waitFor(/DECISION=always/);
      expect(session.output()).toContain("DECISION=always");
    }, 20000);
  },
);

if (skipReason) {
  // Surface the skip so a green run is never mistaken for coverage.
  console.error(`[approval-pty-e2e] SKIPPED — ${skipReason}`);
}
