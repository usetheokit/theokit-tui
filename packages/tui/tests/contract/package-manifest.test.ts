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
  // `./package.json` maps to a plain string; every other subpath maps to a conditions
  // object. The union says so rather than letting the type lie about one of them.
  exports: Record<string, Record<string, string> | string | undefined>;
  files: string[];
  engines: Record<string, string>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
}

const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as PackageManifest;

describe("package manifest contract (T0.1)", () => {
  it("package_manifest_declares_esm_only_types_first_exports", () => {
    expect(pkg.type).toBe("module");
    // M17 T3.1: the renderer ships at the `./renderer` subpath (ADR 0003);
    // the root entry stays first. The `./ai-sdk` back-compat shim was REMOVED —
    // the ai-free projections (`messagesTo*`) on the root entry replace it.
    // All entries are types-first ESM.
    // B-104: `./terminal` ships the loop primitives — a stderr guard, per-key write
    // serialisation and log rotation. A SEPARATE subpath because they reach `node:fs` and
    // `process`, and the root entry is React components: putting them in `.` would drag Node
    // built-ins into every bundle that imports a button.
    // B-104 slice 2: `./keys` ships the modal keypress router — the ORDERING RULE only, with the
    // states, keys and actions as type parameters. Separate from `./terminal` because it is pure:
    // routing a key in a test should not pull in file handles to do it.
    // `./package.json` is last and is a plain string, not a conditions object: it is
    // metadata, not an entry point. Without it `require('@theokit/tui/package.json')`
    // throws ERR_PACKAGE_PATH_NOT_EXPORTED, which bundlers, test-runner resolvers and
    // version telemetry all hit — reproduced against a packed tarball before it was added.
    expect(Object.keys(pkg.exports)).toEqual([
      ".",
      "./renderer",
      "./terminal",
      "./keys",
      "./package.json",
    ]);
    expect(pkg.exports["./package.json"]).toBe("./package.json");
    const dot = (pkg.exports["."] ?? {}) as Record<string, string>;
    // "types" MUST precede "default" — Node/TS resolve conditions in order.
    expect(Object.keys(dot)).toEqual(["types", "default"]);
    expect(dot.types).toBe("./dist/index.d.ts");
    expect(dot.default).toBe("./dist/index.js");
    const renderer = (pkg.exports["./renderer"] ?? {}) as Record<string, string>;
    expect(Object.keys(renderer)).toEqual(["types", "default"]);
    expect(renderer.types).toBe("./dist/renderer/index.d.ts");
    expect(renderer.default).toBe("./dist/renderer/index.js");
    const terminal = (pkg.exports["./terminal"] ?? {}) as Record<string, string>;
    expect(Object.keys(terminal)).toEqual(["types", "default"]);
    expect(terminal.types).toBe("./dist/terminal/index.d.ts");
    expect(terminal.default).toBe("./dist/terminal/index.js");
    const keys = (pkg.exports["./keys"] ?? {}) as Record<string, string>;
    expect(Object.keys(keys)).toEqual(["types", "default"]);
    expect(keys.types).toBe("./dist/keys/index.d.ts");
    expect(keys.default).toBe("./dist/keys/index.js");
    expect(pkg.files).toEqual(["dist"]);
    // Legacy resolution fields must point at the same ESM artifacts
    // (review F-arch-3 — a stale "main" passes exports-only assertions).
    expect(pkg.main).toBe("./dist/index.js");
    expect(pkg.types).toBe("./dist/index.d.ts");
  });

  it("package_manifest_declares_the_gate_chain_scripts_ci_depends_on", () => {
    // ci.yml invokes these script keys (review F-arch-4) — and it invokes them at the WORKSPACE
    // ROOT, which is where they live since B-109 made this repo a workspace. Asserting them on the
    // package manifest would assert against a file CI never runs (measured: `format:check` moved
    // to the root and this test still passed reading the package, because `lint` happened to exist
    // in both).
    const root = JSON.parse(
      readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };
    for (const key of [
      "format:check",
      "lint",
      "typecheck",
      "test",
      "test:coverage",
      "build",
      "bench",
    ]) {
      expect(typeof root.scripts[key], `root script ${key}`).toBe("string");
    }
  });

  it("package_manifest_declares_react_required_peer_and_ink_as_dependency", () => {
    // M4 evolves the contract: lowlight joins as an OPTIONAL peer (plan D2);
    // M27: figlet joins as a second OPTIONAL peer (renderFigletArt). The `ai`
    // optional peer was REMOVED with the `./ai-sdk` shim — the root-entry
    // projections are structural (`UIMessageLike`), no `ai` types anywhere.
    // react stays the only REQUIRED peer.
    expect(Object.keys(pkg.peerDependencies).sort()).toEqual(["figlet", "lowlight", "react"]);
    expect(pkg.peerDependencies).not.toHaveProperty("ai");
    expect(pkg.peerDependenciesMeta).not.toHaveProperty("ai");
    expect(pkg.peerDependenciesMeta.figlet?.optional).toBe(true);
    // ^19.2.0 — mirrors ink7's exact floor (react >=19.2.0, blueprint M10
    // Corner 2); the 0.10.x line remains the ink5/react18 track.
    expect(pkg.peerDependencies.react).toBe("^19.2.0");
    expect(pkg.dependencies.ink).toMatch(/^\^7/);
  });

  it("package_manifest_declares_apache2_license_and_node22_floor", () => {
    expect(pkg.name).toBe("@theokit/tui");
    expect(pkg.license).toBe("Apache-2.0");
    // 22.12.0, not a bare 22. ink7's floor is the major; this is the org-wide floor,
    // and it is the version CI actually exercises — a bare `>=22` let a consumer on
    // 22.0.0 install a package nothing had ever run on that version.
    expect(pkg.engines.node).toBe(">=22.12.0");
    expect(pkg.sideEffects).toBe(false);
    expect(pkg.private).toBeUndefined();
  });
});
