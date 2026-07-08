import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// M8 T1.1/T1.2 (plan m8-ga-publish): the publish contract — manifest fields,
// publint strictness, README public-copy compliance, snapshot-coverage metric.

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  description?: string;
  keywords?: string[];
  files?: string[];
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("package publish contract (M8 T1.1)", () => {
  it("manifest_declares_publish_fields", () => {
    expect(pkg.description ?? "").toSatisfy(
      (d: string) => d.length > 20,
      "description too short",
    );
    expect(pkg.keywords ?? []).toSatisfy(
      (k: string[]) => k.length >= 5,
      "needs >= 5 keywords",
    );
    expect(pkg.files).toContain("dist");
    expect(pkg.scripts["prepublishOnly"] ?? "").toContain("gates");
    expect(pkg.devDependencies["publint"]).toBeDefined();
  });

  it("react_peer_range_is_honest", () => {
    // M10: ink7 requires react >=19.2.0 exactly (blueprint Corner 2) —
    // the peer mirrors that floor; engines follow ink7 (node >=22).
    const peers = (
      pkg as unknown as { peerDependencies: Record<string, string> }
    ).peerDependencies;
    expect(peers["react"]).toBe("^19.2.0");
    const engines = (pkg as unknown as { engines: Record<string, string> })
      .engines;
    expect(engines["node"]).toBe(">=22");
  });

  it("publint_reports_zero_errors", { timeout: 60000 }, () => {
    // Throws on non-zero exit — publint --strict IS the oracle.
    const out = execFileSync("pnpm", ["exec", "publint", "--strict"], {
      encoding: "utf8",
      timeout: 60000,
    });
    expect(out.toLowerCase()).not.toContain("error");
  });
});

describe("README public-copy contract (M8 T1.2)", () => {
  const md = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  it("readme_exists_outcome_shaped_and_honest", () => {
    expect(md.length).toBeGreaterThan(1500);
    // rules/public-copy.md § 3 — banned until dogfood evidence exists.
    for (const banned of [
      "production-ready",
      "production-grade",
      "battle-tested",
      "enterprise-ready",
      "enterprise-grade",
    ]) {
      expect(md.toLowerCase(), banned).not.toContain(banned);
    }
    expect(md).toContain("npm i");
    expect(md).toContain("useAgentStream");
    expect(md).toContain("WelcomeBanner");
    expect(md).toMatch(/TTFATT|first agent turn/);
    // Internals demoted to a deep-dive section (§ 2 anchor rule).
    expect(md).toMatch(/## (How it works|Architecture|Internals)/);
  });

  it("readme_quickstart_symbols_resolve", async () => {
    const codeBlock = /```tsx?\n([\s\S]*?)```/.exec(md)?.[1] ?? "";
    const importMatch = /import \{([^}]+)\} from "@theokit\/tui"/.exec(
      codeBlock,
    );
    expect(
      importMatch,
      "quickstart must import from @theokit/tui",
    ).not.toBeNull();
    const names = (importMatch?.[1] ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    expect(names.length).toBeGreaterThanOrEqual(3);
    const mod = await import("../src/index.js");
    for (const name of names) {
      expect(mod, name).toHaveProperty(name);
    }
  });
});

describe("TTFATT record (M8 T2.2)", () => {
  it("ttfatt_record_exists_with_measurement", () => {
    const md = readFileSync(
      new URL("../docs/ttfatt.md", import.meta.url),
      "utf8",
    );
    expect(md).toMatch(/@theokit\/tui@0\.10\.0/);
    expect(md).toMatch(/@theokit\/tui@0\.11\.0/);
    expect(md).toMatch(/\d+(\.\d+)?\s?(s|seconds|min)/);
    expect(md).toContain("npm i");
  });
});

// SUNSET: migration-window guard — retire (or re-base) at the 0.12.0 cut;
// legitimate it.each refactors after M10 should re-base M10_BASE instead.
describe("never-weaken migration guard (M10 D2)", () => {
  it("it_count_never_decreases", () => {
    const M10_BASE = "035ae09";
    const changed = execFileSync(
      "git",
      ["diff", "--name-only", M10_BASE, "--", "src", "tests"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter((f) => /\.test\./.test(f));
    for (const f of changed) {
      let before = 0;
      try {
        before = (
          execFileSync("git", ["show", `${M10_BASE}:${f}`], {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
          }).match(/\bit\(/g) ?? []
        ).length;
      } catch (thrown) {
        // Only "file did not exist at the base" means new-file; anything
        // else (bad revision, shallow clone) must fail LOUD.
        const msg = String((thrown as { stderr?: unknown }).stderr ?? thrown);
        if (/exists on disk, but not in|does not exist in/.test(msg)) {
          continue;
        }
        throw thrown;
      }
      const after = (
        readFileSync(new URL(`../${f}`, import.meta.url), "utf8").match(
          /\bit\(/g,
        ) ?? []
      ).length;
      expect(after, f).toBeGreaterThanOrEqual(before);
    }
  });
});

describe("platform coherence (M10 T2.3)", () => {
  it("readme_and_ci_declare_new_platform", () => {
    const ci = readFileSync(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    );
    expect(ci).toContain("22.x");
    expect(ci).not.toContain("20.x");
    const md = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    expect(md).toMatch(/Node ≥ 22|node >= ?22|Node 22/i);
    expect(md).toContain("react@19");
  });
});

describe("snapshot re-record review guard (M10 T1.4)", () => {
  it("rerecorded_snapshots_all_reviewed", () => {
    const M10_BASE = "035ae09";
    const table = readFileSync(
      new URL(
        "../.claude/knowledge-base/implementations/m10-snapshot-review.md",
        import.meta.url,
      ),
      "utf8",
    );
    // Only RE-RECORDS (diffs with deletions) need review-table rows —
    // additions-only diffs are NEW snapshots from later milestones.
    const numstat = execFileSync(
      "git",
      [
        "diff",
        "--numstat",
        M10_BASE,
        "--",
        "src/__snapshots__",
        "tests/__snapshots__",
      ],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const line of numstat) {
      const [, deleted, file] = line.split("\t");
      if (Number(deleted) === 0 || file === undefined) {
        continue;
      }
      const base = file.split("/").pop() ?? file;
      expect(table, file).toContain(base);
    }
  });
});
