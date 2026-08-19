import { Box, Text, render } from "ink";
import { createElement } from "react";
import type React from "react";

import { ComponentBoundary } from "../component-boundary.js";

// B-031 — the app the subprocess test renders, kept as a real source file so `tsc` type-checks it
// with the rest of the package. A string built inside a test would drift from the API it exercises.
//
// Three siblings. Two environment switches, because one fixture has to measure three states and
// review found the third missing:
//
//   WRAPPED=1  the middle sibling sits inside `ComponentBoundary`
//   THROW=0    the middle sibling renders normally
//
// `THROW=0` exists because every test passed `WRAPPED=1` against a fixture that ALWAYS threw, so
// the healthy path — the boundary costing nothing when nothing fails — was exercised by nothing. A
// mutant rendering the fallback ALWAYS, which would replace every healthy component in the package
// with `[X unavailable]`, survived three of four tests (F-tests-1, F-arch-3).

function ThrowingComponent(): never {
  throw new TypeError("SelectList: window must be a positive integer — got 0");
}

function HealthyComponent(): React.ReactElement {
  return <Text>MIDDLE-RENDERED</Text>;
}

const middle = createElement(
  process.env["THROW"] === "0" ? HealthyComponent : ThrowingComponent,
);

// PRESET_EXIT lets a test set a NARROWER code before rendering, the way a CLI reports a usage error
// before it draws anything. A boundary that assigns unconditionally destroys it (F-arch-1).
if (process.env["PRESET_EXIT"]) {
  process.exitCode = Number(process.env["PRESET_EXIT"]);
}

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
