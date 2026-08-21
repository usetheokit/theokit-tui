import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { ChoiceRow, DEFAULT_APPROVAL_CHOICES, InkInputProvider } from "../src/index.js";

// #41 regression: the interactive components (ChoiceRow / SelectList / Pager /
// FreeTextInput and the decision prompts) consume the custom V4 renderer's
// input+focus hooks, whose InputContext is NOT mounted under pure Ink's
// `render` — so they rendered but silently ignored every key. `<InkInputProvider>`
// is the bridge: it wires an InputSource to Ink's stdin and provides the
// InputContext + FocusProvider so those components receive input under Ink.

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("InkInputProvider (bridge — #41)", () => {
  it("delivers_keys_to_a_custom_hook_component_under_ink", async () => {
    const committed: string[] = [];
    const app = render(
      <InkInputProvider>
        <ChoiceRow choices={[...DEFAULT_APPROVAL_CHOICES]} onCommit={(v) => committed.push(v)} />
      </InkInputProvider>,
    );
    // Let autoFocus register with the FocusProvider before driving input.
    await tick();
    await tick();
    app.stdin.write("\r"); // Enter commits the active (first) choice
    await tick();
    app.unmount();
    // The first DEFAULT_APPROVAL_CHOICES value is "once".
    expect(committed).toEqual(["once"]);
  });

  it("arrow_then_enter_commits_the_moved_choice", async () => {
    const committed: string[] = [];
    const app = render(
      <InkInputProvider>
        <ChoiceRow choices={[...DEFAULT_APPROVAL_CHOICES]} onCommit={(v) => committed.push(v)} />
      </InkInputProvider>,
    );
    await tick();
    await tick();
    app.stdin.write("\x1b[C"); // right arrow -> move to "always"
    await tick();
    app.stdin.write("\r");
    await tick();
    app.unmount();
    expect(committed).toEqual(["always"]);
  });

  it("without_the_bridge_the_same_component_ignores_input_under_ink", async () => {
    // Documents the bug the bridge fixes: no InputContext under Ink -> the
    // custom useInput no-ops, so the key never reaches onCommit.
    const committed: string[] = [];
    const app = render(
      <ChoiceRow choices={[...DEFAULT_APPROVAL_CHOICES]} onCommit={(v) => committed.push(v)} />,
    );
    await tick();
    await tick();
    app.stdin.write("\r");
    await tick();
    app.unmount();
    expect(committed).toEqual([]);
  });
});
