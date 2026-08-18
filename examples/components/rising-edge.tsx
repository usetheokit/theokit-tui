import { Box, render, Text } from "ink";
import { useEffect, useState } from "react";

import { TheoTUIProvider, useRisingEdge } from "../../src/index.js";

// B-011 example: a level that climbs, recovers and climbs again — warned twice, not four times.
//
// The vocabulary is this example's, not the library's: the hook is told the ordering and knows
// nothing else. Recovery says nothing, deliberately — announcing it would train the user to dismiss
// the channel the bad news arrives on. But the SECOND climb warns again, because a problem that
// comes back has to be visible.
const LEVELS = ["calm", "busy", "urgent"] as const;
const SCRIPT = ["calm", "busy", "urgent", "busy", "calm", "urgent"] as const;

function Pressure() {
  const [step, setStep] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (step >= SCRIPT.length - 1) return;
    const t = setTimeout(() => setStep((n) => n + 1), 30);
    return () => clearTimeout(t);
  }, [step]);

  const level = SCRIPT[step] ?? "calm";
  useRisingEdge(level, LEVELS, (l) => {
    setWarnings((w) => [...w, `rose to ${l}`]);
  });

  return (
    <Box flexDirection="column">
      <Text>path: {SCRIPT.slice(0, step + 1).join(" → ")}</Text>
      <Text>changes: {step}</Text>
      <Text>warnings: {warnings.length}</Text>
      {warnings.map((w) => (
        <Text key={w} dimColor>
          · {w}
        </Text>
      ))}
    </Box>
  );
}

const instance = render(
  <TheoTUIProvider>
    <Pressure />
  </TheoTUIProvider>,
);
setTimeout(() => {
  instance.unmount();
}, 400);
