import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// M10 D3: baselines are stack-relative — provenance is never implicit again.
describe("baseline stack provenance (M10 D3)", () => {
  const files = [
    "m0-chat-message",
    "m1-chat-thread",
    "m2-tool-cards",
    "m3-agent-timeline",
    "m4-diff-viewer",
    "m5-metrics",
  ];
  it("baseline_records_stack_versions", () => {
    for (const name of files) {
      const b = JSON.parse(
        readFileSync(
          new URL(
            `../benchmarks/baselines/${name}-baseline.json`,
            import.meta.url,
          ),
          "utf8",
        ),
      ) as { stack?: { ink?: string; react?: string } };
      expect(b.stack?.ink, name).toMatch(/^7\./);
      expect(b.stack?.react, name).toMatch(/^19\./);
      expect(
        (b.stack as { ink_testing_library?: string })?.ink_testing_library,
        name,
      ).toMatch(/^4\./);
    }
  });
});
