import { Box, render } from "ink";

import {
  ContextWindowBar,
  CostMeter,
  TheoTUIProvider,
  TokenUsageChart,
  UsagePanel,
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
      {/* B-001 — the same three meters, composed from one `TurnUsage`. The second panel carries
          no `cost` and no optional token counts, so it shows what "absent is absent" looks like:
          no cost line, and no rows claiming a zero the agent never reported (ADR D2). */}
      <UsagePanel
        marginTop={1}
        usage={{
          inputTokens: 79_360,
          outputTokens: 14_800,
          totalTokens: 94_160,
          cacheReadTokens: 2_400,
          cost: 1.87,
        }}
        contextWindow={128_000}
      />
      <UsagePanel
        marginTop={1}
        usage={{ inputTokens: 12_000, outputTokens: 3_000, totalTokens: 15_000 }}
        contextWindow={128_000}
      />
    </Box>
  </TheoTUIProvider>,
);
setTimeout(() => {
  instance.unmount();
}, 50);
