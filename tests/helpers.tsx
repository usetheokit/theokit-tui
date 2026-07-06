import { render } from "ink-testing-library";
import type { ReactElement } from "react";

/**
 * Single determinism point for frame assertions (plan ADR D2):
 * render + one React tick + lastFrame. Borrowed from the react-ink analog
 * (assistant-ui packages/react-ink src/tests/helpers.tsx).
 */
export const renderFrame = async (node: ReactElement): Promise<string> => {
  const instance = render(node);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const frame = instance.lastFrame() ?? "";
  instance.unmount();
  return frame;
};
