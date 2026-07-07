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
