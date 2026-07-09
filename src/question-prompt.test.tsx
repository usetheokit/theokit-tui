import { describe, expect, it } from "vitest";

import { render, type ItlInstance } from "../tests/renderer/itl-adapter.js";
import { QuestionPrompt } from "./question-prompt.js";
import type { SelectListItem } from "./select-list-model.js";
import type { QuestionAnswer } from "./agent-decision-model.js";

/**
 * Poll the frame for `substring` (deterministic, not a fixed sleep — testing.md
 * §6). Used to wait for the free-text input to mount + capture focus after the
 * SelectList unmounts, before driving keys into it.
 */
async function waitForFrame(
  app: ItlInstance,
  substring: string,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((app.lastFrame() ?? "").includes(substring)) return;
    await app.flush();
  }
  throw new Error(
    `frame never contained ${JSON.stringify(substring)} — got:\n${app.lastFrame()}`,
  );
}

/**
 * Type an atomic key burst, retrying until it echoes. A FreeTextInput subscribes
 * a render or two after mount (the focus round-trip), so the first burst can land
 * before it is listening; the burst is atomic (all keys or none), so re-sending
 * it while the buffer is empty is safe (no duplication) and deterministic.
 */
async function typeWhenReady(app: ItlInstance, text: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    app.stdin.write(text);
    try {
      await waitForFrame(app, text, 300);
      return;
    } catch {
      /* not subscribed yet — retry the atomic burst */
    }
  }
  throw new Error(`input never accepted ${JSON.stringify(text)}`);
}

// M23 T2.1 — QuestionPrompt over the itl-adapter. A per-question header + question
// text + a composed M22 SelectList (single or multi) with an optional "Other…"
// free-text branch (ADR D6). The answer leaves via one `onAnswer({values,text})`
// callback. Deterministic keyboard oracle.

const OPTIONS: SelectListItem[] = [
  { value: "red", label: "red" },
  { value: "green", label: "green" },
  { value: "blue", label: "blue" },
];

describe("QuestionPrompt component (M23 T2.1)", () => {
  it("renders_the_header_and_question", async () => {
    const app = render(
      <QuestionPrompt
        header="Deploy target"
        question="Which environment?"
        options={OPTIONS}
        onAnswer={() => {}}
      />,
    );
    await app.flush();
    const frame = app.lastFrame();
    expect(frame).toContain("Deploy target");
    expect(frame).toContain("Which environment?");
    expect(frame).toContain("red");
    app.unmount();
  });

  it("single_select_answer_carries_one_value", async () => {
    const answers: QuestionAnswer[] = [];
    const app = render(
      <QuestionPrompt
        header="H"
        question="Q?"
        options={OPTIONS}
        onAnswer={(a) => answers.push(a)}
      />,
    );
    await app.flush();
    app.stdin.write("\x1b[B"); // down → green
    await app.flush();
    app.stdin.write("\r"); // enter
    expect(answers).toEqual([{ values: ["green"] }]);
    app.unmount();
  });

  it("multi_select_answer_carries_many_values", async () => {
    const answers: QuestionAnswer[] = [];
    const app = render(
      <QuestionPrompt
        header="H"
        question="Q?"
        options={OPTIONS}
        multi
        onAnswer={(a) => answers.push(a)}
      />,
    );
    await app.flush();
    app.stdin.write(" "); // toggle red
    await app.flush();
    app.stdin.write("\x1b[B"); // down → green
    await app.flush();
    app.stdin.write("\x1b[B"); // down → blue
    await app.flush();
    app.stdin.write(" "); // toggle blue
    await app.flush();
    app.stdin.write("\r"); // enter
    expect(answers).toHaveLength(1);
    expect(answers[0]?.values.sort()).toEqual(["blue", "red"]);
    expect(answers[0]?.text).toBeUndefined();
    app.unmount();
  });

  it("other_sentinel_reveals_a_free_text_input", async () => {
    const app = render(
      <QuestionPrompt
        header="H"
        question="Pick a color"
        options={OPTIONS}
        allowFreeText
        onAnswer={() => {}}
      />,
    );
    await app.flush();
    expect(app.lastFrame()).toContain("Other"); // the sentinel is injected
    // navigate down past the 3 real options to "Other…" and select it
    app.stdin.write("\x1b[A"); // up from row 0 → wraps to last ("Other…")
    await app.flush();
    app.stdin.write("\r"); // enter → free-text mode
    await waitForFrame(app, "Type your answer:");
    expect(app.lastFrame().toLowerCase()).toContain("type");
    app.unmount();
  });

  it("free_text_answer_carries_text_and_no_sentinel_value", async () => {
    const answers: QuestionAnswer[] = [];
    const app = render(
      <QuestionPrompt
        header="H"
        question="Pick"
        options={OPTIONS}
        allowFreeText
        onAnswer={(a) => answers.push(a)}
      />,
    );
    await app.flush();
    app.stdin.write("\x1b[A"); // wrap to "Other…"
    await app.flush();
    app.stdin.write("\r"); // → free-text mode
    await waitForFrame(app, "Type your answer:"); // input mounted
    await typeWhenReady(app, "teal"); // subscribe lags focus — retry the burst
    app.stdin.write("\r"); // submit free text
    expect(answers).toEqual([{ values: [], text: "teal" }]);
    app.unmount();
  });

  it("no_free_text_when_allowFreeText_is_false", async () => {
    const app = render(
      <QuestionPrompt
        header="H"
        question="Q"
        options={OPTIONS}
        onAnswer={() => {}}
      />,
    );
    await app.flush();
    expect(app.lastFrame()).not.toContain("Other");
    app.unmount();
  });

  it("empty_submit_is_a_noop", async () => {
    const answers: QuestionAnswer[] = [];
    const app = render(
      <QuestionPrompt
        header="H"
        question="Q"
        options={[]}
        onAnswer={(a) => answers.push(a)}
      />,
    );
    await app.flush();
    app.stdin.write("\r"); // nothing selected, no options → no-op
    await app.flush();
    expect(answers).toEqual([]);
    app.unmount();
  });

  it("empty_options_render_without_crashing", async () => {
    const app = render(
      <QuestionPrompt
        header="H"
        question="No options here"
        options={[]}
        onAnswer={() => {}}
      />,
    );
    await app.flush();
    expect(app.lastFrame()).toContain("No options here");
    app.unmount();
  });
});
