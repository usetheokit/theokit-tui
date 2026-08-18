import { Box, render } from "ink";

import {
  ContextWindowBar,
  CostMeter,
  TheoTUIProvider,
  TokenUsageChart,
} from "../../src/index.js";

// Metrics-surface demo (plan T3.2 — TTFATT caller): the always-on agent
// footer — context gauge + per-category token bars + cost. Static scene, so
// piped output is clean; no optional deps, no async preload.
const instance = render(
  <TheoTUIProvider>
    <Box flexDirection="column">
      <ContextWindowBar usedTokens={79_360} limitTokens={128_000} width={46} />
      <TokenUsageChart
        usage={{ input: 62_100, output: 14_800, cached: 2_400 }}
        width={46}
      />
      <CostMeter costUsd={1.87} />
    </Box>
  </TheoTUIProvider>,
);
setTimeout(() => {
  instance.unmount();
}, 50);
