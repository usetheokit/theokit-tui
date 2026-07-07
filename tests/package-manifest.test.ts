import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Packaging contract for @theokit/tui (plan T0.1, ADR D8).
// The manifest IS the M0 deliverable: these invariants protect consumers
// from silent packaging regressions (a stray CJS field, a widened peer set).
interface PackageManifest {
  name: string;
  type: string;
  license: string;
  sideEffects: boolean;
  private?: unknown;
  main: string;
  types: string;
  exports: Record<string, Record<string, string> | undefined>;
  files: string[];
  engines: Record<string, string>;
  peerDependencies: Record<string, string>;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
}

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

describe("package manifest contract (T0.1)", () => {
  it("package_manifest_declares_esm_only_types_first_exports", () => {
    expect(pkg.type).toBe("module");
    expect(Object.keys(pkg.exports)).toEqual(["."]);
    const dot = pkg.exports["."] ?? {};
    // "types" MUST precede "default" — Node/TS resolve conditions in order.
    expect(Object.keys(dot)).toEqual(["types", "default"]);
    expect(dot["types"]).toBe("./dist/index.d.ts");
    expect(dot["default"]).toBe("./dist/index.js");
    expect(pkg.files).toEqual(["dist"]);
    // Legacy resolution fields must point at the same ESM artifacts
    // (review F-arch-3 — a stale "main" passes exports-only assertions).
    expect(pkg.main).toBe("./dist/index.js");
    expect(pkg.types).toBe("./dist/index.d.ts");
  });

  it("package_manifest_declares_the_gate_chain_scripts_ci_depends_on", () => {
    // ci.yml invokes these script keys (review F-arch-4).
    for (const key of [
      "format:check",
      "lint",
      "typecheck",
      "test",
      "test:coverage",
      "build",
      "bench",
    ]) {
      expect(typeof pkg.scripts[key]).toBe("string");
    }
  });

  it("package_manifest_declares_react_required_peer_and_ink_as_dependency", () => {
    // M4 evolves the contract: lowlight joins as an OPTIONAL peer (plan D2);
    // react stays the only REQUIRED peer.
    expect(Object.keys(pkg.peerDependencies).sort()).toEqual([
      "lowlight",
      "react",
    ]);
    expect(pkg.peerDependencies.react).toBe("^18.0.0 || ^19.0.0");
    expect(pkg.dependencies.ink).toMatch(/^\^5/);
  });

  it("package_manifest_declares_apache2_license_and_node20_floor", () => {
    expect(pkg.name).toBe("@theokit/tui");
    expect(pkg.license).toBe("Apache-2.0");
    expect(pkg.engines.node).toBe(">=20");
    expect(pkg.sideEffects).toBe(false);
    expect(pkg.private).toBeUndefined();
  });
});
