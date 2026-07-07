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
