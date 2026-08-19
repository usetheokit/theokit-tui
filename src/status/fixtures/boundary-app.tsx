import { Box, Text, render } from "ink";
import { createElement } from "react";

import { ComponentBoundary } from "../component-boundary.js";

// B-031 — the app the subprocess test renders, kept as a real source file so `tsc` type-checks it
// with the rest of the package. A string built inside a test would drift from the API it exercises.
//
// Three siblings, the middle one throwing exactly as a boundary guard does. `WRAPPED=1` decides
// whether the middle one sits inside `ComponentBoundary`, so one fixture measures both the defect
// and the fix.

function ThrowingComponent(): never {
  throw new TypeError("SelectList: window must be a positive integer — got 0");
}

const middle = createElement(ThrowingComponent);

const app = render(
  <Box flexDirection="column">
    <Text>ABOVE-SURVIVED</Text>
    {process.env["WRAPPED"] === "1" ? (
      <ComponentBoundary component="SelectList">{middle}</ComponentBoundary>
    ) : (
      middle
    )}
    <Text>BELOW-SURVIVED</Text>
  </Box>,
);

// Swallow the rejection ink produces on an uncontained throw: this fixture is measuring the EXIT
// CODE, and an unhandled rejection would set one of its own and hide what is being measured.
void app.waitUntilExit().catch(() => undefined);

setTimeout(() => {
  app.unmount();
  process.exit(process.exitCode ?? 0);
}, 300);
