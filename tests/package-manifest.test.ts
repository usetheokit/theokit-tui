import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Packaging contract for @theokit/tui (plan T0.1, ADR D8).
// The manifest IS the M0 deliverable: these invariants protect consumers
// from silent packaging regressions (a stray CJS field, a widened peer set).
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as Record<string, any>;

describe("package manifest contract (T0.1)", () => {
  it("package_manifest_declares_esm_only_types_first_exports", () => {
    expect(pkg.type).toBe("module");
    expect(Object.keys(pkg.exports)).toEqual(["."]);
    // "types" MUST precede "default" — Node/TS resolve conditions in order.
    expect(Object.keys(pkg.exports["."])).toEqual(["types", "default"]);
    expect(pkg.exports["."].types).toBe("./dist/index.d.ts");
    expect(pkg.exports["."].default).toBe("./dist/index.js");
    expect(pkg.files).toEqual(["dist"]);
  });

  it("package_manifest_declares_react_as_only_peer_and_ink_as_dependency", () => {
    expect(Object.keys(pkg.peerDependencies)).toEqual(["react"]);
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
