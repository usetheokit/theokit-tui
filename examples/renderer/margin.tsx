import { Box, render, Text } from "ink";

import { Banner, ChatMessage, CostMeter, TheoTUIProvider, TodoList } from "../../src/index.js";

// Universal margin API demo: EVERY component accepts the CSS/Ink margin family
// (margin / marginX / marginY / marginTop / marginRight / marginBottom /
// marginLeft) and applies it to its root layout — space any component from its
// neighbours without a wrapper Box. Passing no margin is a no-op (byte-identical
// to before the prop existed). Renders statically (safe piped to `cat`).

function Demo() {
  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <Text dimColor>── top marker ──</Text>

        {/* marginTop pushes the component down by N terminal rows */}
        <CostMeter costUsd={1.23} marginTop={1} marginLeft={4} />

        {/* marginY = blank row above AND below */}
        <TodoList
          items={[
            { id: "a", label: "wired", status: "done" },
            { id: "b", label: "shipping", status: "active" },
          ]}
          marginY={1}
        />

        {/* marginLeft indents a whole component */}
        <Banner name="Theo" marginLeft={2} />

        <ChatMessage role="assistant" marginTop={1}>
          Any component — even this ChatMessage — takes the margin props.
        </ChatMessage>

        <Text dimColor>── bottom marker ──</Text>
      </Box>
    </TheoTUIProvider>
  );
}

render(<Demo />);
