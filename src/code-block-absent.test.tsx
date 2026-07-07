import { describe, expect, it, vi } from "vitest";

// Module-absent suite (plan D2/D8, EC-6): ONE sequential test — the loader
// cache + warn-once flag live at module scope, so separate tests would be
// order-dependent (testing.md § 3). This file relies on vitest's default
// per-file module isolation to keep the mocked module from leaking into the
// loaded suite (src/code-block.test.tsx).
vi.mock("lowlight", () => {
  throw Object.assign(new Error("Cannot find module 'lowlight'"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});

import { renderFrame } from "../tests/helpers.js";
import { CodeBlock, ensureHighlighter } from "./code-block.js";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\u001B\[[0-9;]*m/g, "");

describe("CodeBlock — optional peer absent (T2.1, ADR D2)", () => {
  it("absent_module_degrades_plain_warns_once_and_resolves_undefined", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const first = await renderFrame(
        <CodeBlock code={"const x = 1;"} language="typescript" />,
      );
      expect(stripAnsi(first)).toContain("const x = 1;");
      expect(first).not.toMatch(/\[3[0-9]m/);

      await renderFrame(
        <CodeBlock code={"const y = 2;"} language="typescript" />,
      );
      const lowlightWarnings = warnSpy.mock.calls.filter((call) =>
        String(call[0]).includes("lowlight"),
      );
      expect(lowlightWarnings).toHaveLength(1);

      await expect(ensureHighlighter()).resolves.toBeUndefined();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
