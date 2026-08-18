import { render } from "ink-testing-library";
import type { ReactElement } from "react";

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
export const renderFrame = async (node: ReactElement): Promise<string> => {
  const instance = render(node);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const frame = instance.lastFrame() ?? "";
  instance.unmount();
  return frame;
};
