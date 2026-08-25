import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { stripAnsi } from "../../src/format/ansi.js";
import { PermissionPrompt } from "../../src/prompts/permission-prompt.js";

// A consumer telling the user WHICH KEYS settle the prompt had nowhere sensible to put it.
//
// `hint` renders with `ruleNote`, before the question — right for `/permissions to update rules`,
// which is context, and wrong for `Enter to confirm · Esc to reject`, which is an instruction about
// the choices below it. Read before the question, the instruction arrives before the thing it
// applies to.
//
// Claude Code puts it under the list:
//
//     ❯ 1. Yes, I trust this folder
//       2. No, exit
//
//     Enter to confirm · Esc to cancel

const HINT = "Enter to confirm · Esc to reject";

function frame(props: Parameters<typeof PermissionPrompt>[0]): string[] {
  const instance = render(<PermissionPrompt {...props} />);
  const out = stripAnsi(instance.lastFrame() ?? "")
    .split("\n")
    .filter((l) => l.trim() !== "");
  instance.unmount();
  return out;
}

const base = {
  toolType: "Run command",
  command: "echo hi",
  hint: HINT,
  onDecision: () => {},
  autoFocus: false,
} as const;

const indexOf = (rows: string[], needle: string): number =>
  rows.findIndex((r) => r.includes(needle));

describe("hintPlacement", () => {
  it("test_the_default_is_unchanged", () => {
    // Additive by contract: every existing consumer keeps the layout it has.
    const rows = frame(base);

    expect(indexOf(rows, HINT)).toBeLessThan(indexOf(rows, "Do you want to proceed?"));
  });

  it("test_below_puts_the_hint_after_the_choices", () => {
    const rows = frame({ ...base, hintPlacement: "below" });

    expect(indexOf(rows, HINT)).toBeGreaterThan(indexOf(rows, "Do you want to proceed?"));
    expect(
      indexOf(rows, HINT),
      "the hint must clear the choice list, not merely the question",
    ).toBeGreaterThan(indexOf(rows, "No"));
  });

  it("test_below_does_not_render_it_twice", () => {
    // The obvious failure of adding a second render site is leaving the first one in.
    const rows = frame({ ...base, hintPlacement: "below" });

    expect(rows.filter((r) => r.includes(HINT))).toHaveLength(1);
  });

  it("test_a_ruleNote_stays_above_regardless", () => {
    // `ruleNote` is context about the rule that gated the call — it belongs before the question at
    // either placement, and moving it with the hint would be a silent relocation.
    const rows = frame({
      ...base,
      ruleNote: "Permission rule Bash(npm *)",
      hintPlacement: "below",
    });

    expect(indexOf(rows, "Permission rule")).toBeLessThan(indexOf(rows, "Do you want to proceed?"));
    expect(indexOf(rows, HINT)).toBeGreaterThan(indexOf(rows, "Do you want to proceed?"));
  });

  it("test_below_with_no_hint_renders_nothing_extra", () => {
    // `hint` is OMITTED rather than set to `undefined`: this package compiles with
    // `exactOptionalPropertyTypes`, so the two are different types and only omission is legal.
    const { hint: _omitted, ...noHint } = base;
    const withHint = frame({ ...base, hintPlacement: "below" });
    const without = frame({ ...noHint, hintPlacement: "below" });

    expect(without.length).toBeLessThan(withHint.length);
  });
});
