import { describe, expect, it } from "vitest";

import { composerShortcutsFor, footerHintFor } from "../../src/shortcuts/composer-capabilities.js";
import { DEFAULT_COMPOSER_SHORTCUTS } from "../../src/shortcuts/keyboard-help.js";

// B-005 (plan b005-capability-affordances, ADRs D1-D5): affordances a caller declares.
describe("composerShortcutsFor", () => {
  it("an_undeclared_capability_is_not_advertised", () => {
    const keys = composerShortcutsFor({}).map((s) => s.keys);
    // The five measured as gated on an optional prop. `Ctrl+C` is a separate case (ADR D3):
    // it is unconditional here because the RUNTIME provides it, not the composer.
    expect(keys).not.toContain("!");
    expect(keys).not.toContain("?");
    expect(keys).not.toContain("/");
    expect(keys).not.toContain("@");
  });

  it("keeps_every_unconditional_editing_chord", () => {
    const keys = composerShortcutsFor({}).map((s) => s.keys);
    expect(keys).toContain("Enter");
    expect(keys).toContain("Ctrl+W");
    expect(keys).toContain("Ctrl+U / Ctrl+K");
  });

  it("advertises_a_capability_once_it_is_declared", () => {
    const keys = composerShortcutsFor({ shell: true }).map((s) => s.keys);
    expect(keys).toContain("!");
    expect(keys).not.toContain("?");
  });

  // EC-3 — membership is not enough: two lists agreeing on members and disagreeing on order are
  // two different panels, and a substring test would never see it.
  it("declaring_every_capability_matches_the_default_list_in_order", () => {
    expect(
      composerShortcutsFor({
        shell: true,
        help: true,
        commands: true,
        mentions: true,
      }),
    ).toEqual(DEFAULT_COMPOSER_SHORTCUTS);
  });
});

describe("footerHintFor", () => {
  it("an_empty_declaration_is_not_treated_as_absent", () => {
    // D4 / EC-2 — `""` is falsy, and `hint || DEFAULT_HINT` would silently restore every
    // affordance. That is this item's own defect, re-created by the fix for it.
    expect(footerHintFor({})).toBe("");
  });

  it("declaring_only_shortcuts_omits_the_agents_hint", () => {
    const hint = footerHintFor({ shortcuts: true });
    expect(hint).toContain("? for shortcuts");
    expect(hint).not.toContain("agents");
  });

  it("joins_declared_affordances_in_a_stable_order", () => {
    expect(footerHintFor({ shortcuts: true, agents: true })).toBe("? for shortcuts · ← for agents");
  });
});
