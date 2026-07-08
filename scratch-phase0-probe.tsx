import React from "react";
import { Text } from "ink";
import { render } from "ink-testing-library";

import { WelcomeBanner } from "./src/welcome-banner.js";

// Probe: what renders between mount and the FIRST tick (phase=0)?
const instance = render(<Text>probe</Text>);
Object.defineProperty(instance.stdout, "isTTY", {
  get: () => true,
  configurable: true,
});
Object.defineProperty(instance.stdout, "rows", {
  get: () => 30,
  configurable: true,
});
instance.rerender(
  <WelcomeBanner
    name="Theo TUI"
    version="1.0"
    tagline="AI in your terminal"
    hints={["h1 hint row"]}
    animated
    key="gated"
  />,
);
const frame = instance.lastFrame() ?? "";
console.log("=== PHASE-0 FRAME (between mount and first 80ms tick) ===");
console.log(JSON.stringify(frame));
console.log("--- rendered ---");
console.log(frame);
console.log("--- line count:", frame.split("\n").length);
instance.unmount();
