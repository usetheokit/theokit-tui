import { render } from "ink-testing-library";
import type { ReactElement } from "react";

import { waitFor } from "./wait-for.js";

/**
 * Single determinism point for frame assertions (plan ADR D2):
 * render + one React tick + lastFrame. Borrowed from the react-ink analog
 * (assistant-ui packages/react-ink src/tests/helpers.tsx).
 *
 * COUPLING (M2 EC-14): the 0ms tick captures the frame BEFORE ink-spinner's
 * first ~80ms `dots` interval, which is what makes `running` snapshots show
 * frame[0] deterministically. Raising this delay to >= 80ms silently flakes
 * every running-status snapshot — the canary is
 * `running_shows_spinner_first_frame` in src/tool-call.test.tsx.
 */
export const renderFrame = async (
  node: ReactElement,
  /**
   * B-097 — OPT-IN. When given, poll until the frame satisfies this predicate before capturing.
   *
   * Strictly opt-in, and the COUPLING note above is why: the default 0ms tick captures the frame
   * before ink-spinner's first interval, and polling past it would flake every `running` snapshot.
   * A caller that opts in is asserting its own scene has no spinner.
   *
   * What it is FOR: a component that renders once, then re-renders after an async load resolves —
   * `CodeBlock` renders plain and then highlighted. One macrotask is enough for that on an idle
   * machine and not on a loaded runner, which is a wait on a DURATION wearing the clothes of a
   * wait on an EVENT.
   *
   * The predicate must be something the intermediate frame CANNOT satisfy. A colour that also
   * appears elsewhere in the scene is not such a signal — that was the actual defect.
   */
  until?: {
    readonly predicate: (frame: string) => boolean;
    readonly describe: string;
  },
): Promise<string> => {
  const instance = render(node);
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (until !== undefined) {
    // Rung 4 of the parsimony ladder: `waitFor` already exists for exactly this, and its mandatory
    // `describe` is what makes a miss say what never arrived instead of "timeout".
    await waitFor(() => until.predicate(instance.lastFrame() ?? ""), {
      describe: until.describe,
    });
  }
  const frame = instance.lastFrame() ?? "";
  instance.unmount();
  return frame;
};
