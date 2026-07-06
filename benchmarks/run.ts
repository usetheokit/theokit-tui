import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Bench runner (plan T3.1): discovers *.bench.tsx and spawns each via tsx,
// forwarding CLI args (--smoke) and exit codes — fail loud, never swallow
// (rules/error-handling.md § 2). Pattern borrowed from the react-ink analog.
const benchDir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(benchDir).filter((f) => f.endsWith(".bench.tsx"));

if (files.length === 0) {
  console.error("benchmarks/run.ts: no *.bench.tsx files found — aborting");
  process.exit(1);
}

const args = process.argv.slice(2);
for (const file of files) {
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", join(benchDir, file), ...args],
    {
      stdio: "inherit",
    },
  );
  if (result.error) {
    console.error(
      `benchmarks/run.ts: failed to spawn ${file}: ${result.error.message}`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
