import { describe, expect, it } from "vitest";

import { type ChoiceKey, DEFAULT_APPROVAL_CHOICES, resolveChoiceKey } from "./agent-decision.js";

// M23 T1.1 — the pure decision-model keyboard oracle. `resolveChoiceKey` maps a
// keypress over a fixed choice bar of `count` choices at active `index` to a
// move / commit / cancel action (or undefined). No render, no I/O — the table
// that ChoiceRow (and thus ApprovalPrompt / PlanApproval) drives its bar with.

const KEY = (over: Partial<ChoiceKey> = {}): ChoiceKey => ({
  leftArrow: false,
  rightArrow: false,
  upArrow: false,
  downArrow: false,
  return: false,
  escape: false,
  ...over,
});

describe("resolveChoiceKey (M23 T1.1)", () => {
  it("right_arrow_moves_to_next_choice", () => {
    expect(resolveChoiceKey("", KEY({ rightArrow: true }), 3, 0)).toEqual({
      type: "move",
      index: 1,
    });
  });

  it("right_arrow_wraps_at_last", () => {
    expect(resolveChoiceKey("", KEY({ rightArrow: true }), 3, 2)).toEqual({
      type: "move",
      index: 0,
    });
  });

  it("left_arrow_wraps_at_first", () => {
    expect(resolveChoiceKey("", KEY({ leftArrow: true }), 3, 0)).toEqual({
      type: "move",
      index: 2,
    });
  });

  it("down_arrow_moves_to_next_choice_like_right", () => {
    expect(resolveChoiceKey("", KEY({ downArrow: true }), 3, 0)).toEqual({
      type: "move",
      index: 1,
    });
  });

  it("up_arrow_wraps_at_first_like_left", () => {
    expect(resolveChoiceKey("", KEY({ upArrow: true }), 3, 0)).toEqual({
      type: "move",
      index: 2,
    });
  });

  it("number_key_selects_nth_choice", () => {
    expect(resolveChoiceKey("2", KEY(), 3, 0)).toEqual({
      type: "move",
      index: 1,
    });
  });

  it("number_key_out_of_range_is_ignored", () => {
    expect(resolveChoiceKey("9", KEY(), 3, 0)).toBeUndefined();
    expect(resolveChoiceKey("0", KEY(), 3, 0)).toBeUndefined();
  });

  it("enter_commits_active", () => {
    expect(resolveChoiceKey("", KEY({ return: true }), 3, 1)).toEqual({
      type: "commit",
    });
  });

  it("escape_cancels", () => {
    expect(resolveChoiceKey("", KEY({ escape: true }), 3, 1)).toEqual({
      type: "cancel",
    });
  });

  it("unbound_key_returns_undefined", () => {
    expect(resolveChoiceKey("x", KEY(), 3, 0)).toBeUndefined();
  });

  it("arrows_are_a_noop_when_there_are_no_choices", () => {
    expect(resolveChoiceKey("", KEY({ rightArrow: true }), 0, 0)).toBeUndefined();
    expect(resolveChoiceKey("", KEY({ leftArrow: true }), 0, 0)).toBeUndefined();
  });

  it("default_approval_choices_are_once_always_reject", () => {
    expect(DEFAULT_APPROVAL_CHOICES.map((c) => c.value)).toEqual(["once", "always", "reject"]);
  });
});
