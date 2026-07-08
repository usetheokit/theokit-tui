import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

// M19 T3.1 (plan m19-input-stack, ADR D6): the node-pty e2e — the ONLY tier that
// drives the REAL raw-mode path (stdin.isTTY === true + real setRawMode in a
// pseudo-terminal), permanently closing the M15 EC-5 gap. Per EC-7 it SKIPs
// gracefully (never a false green) when node-pty's native module cannot load.

const here = dirname(fileURLToPath(import.meta.url));
const harness = join(here, "input-pty-harness.tsx");
const tsx = join(here, "..", "..", "node_modules", ".bin", "tsx");

// Load node-pty; if its native module is unavailable, skip the whole suite.
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

describe.skipIf(!pty)("input PTY e2e — real raw-mode path (M19 T3.1)", () => {
  it("drives_real_raw_mode_and_folds_keys_into_the_buffer", async () => {
    const session = spawnHarness(pty!);
    sessions.push(session);
    // The harness reports isTTY — the REAL raw-mode path (a pipe would be false).
    const ready = await session.waitFor(/READY tty=(true|false)/);
    expect(ready).toContain("READY tty=true");

    session.write("hi");
    await session.waitFor(/BUF:hi/);
    expect(session.output()).toContain("BUF:hi");

    // EC-5: a submit whose handler throws must NOT be swallowed, and the draft
    // must survive on the REAL raw-mode path (closes the M15 gap permanently).
    session.write("\r");
    await session.waitFor(/DRAFT:hi/);
    expect(session.output()).toContain("SUBMIT_ERROR:submit exploded");
    expect(session.output()).toContain("DRAFT:hi");

    session.write("\x03"); // Ctrl+C → clean exit
  });

  it("parses_arrow_and_backspace_over_the_real_pty", async () => {
    const session = spawnHarness(pty!);
    sessions.push(session);
    await session.waitFor(/READY tty=true/);
    session.write("abc");
    await session.waitFor(/BUF:abc/);
    session.write("\x1b[D"); // left arrow (real CSI over the pty)
    session.write("\x7f"); // backspace → deletes "b"
    await session.waitFor(/BUF:ac/);
    expect(session.output()).toContain("BUF:ac");
    session.write("\x03");
  });
});

if (skipReason) {
  // Surface the skip so a green run is never mistaken for coverage (EC-7).
  console.error(`[pty-e2e] SKIPPED — ${skipReason}`);
}
