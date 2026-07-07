import { Box, Text, render } from "ink";

import { TheoTUIProvider, VERSION, WelcomeBanner } from "../src/index.js";

// Welcome-banner demo (plan m9-welcome-banner T2.2 — TTFATT caller): the
// startup banner every agent CLI mounts first. Piped (non-TTY) stdout is the
// EC-2 environment by construction — columns undefined → width fallback 60.
function Demo() {
  return (
    <TheoTUIProvider>
      <Box flexDirection="column">
        <WelcomeBanner
          name="Theo TUI"
          version={VERSION}
          tagline="AI-agent primitives for the terminal"
          hints={[
            "/help for commands",
            "esc to cancel a running turn",
            "docs: github.com/usetheodev/theokit-tui",
          ]}
        >
          <Text dimColor>cwd: ~/projects/demo</Text>
        </WelcomeBanner>
      </Box>
    </TheoTUIProvider>
  );
}

const instance = render(<Demo />);
// House shape (plan EC-5): every smoke-tested example unmounts explicitly.
setTimeout(() => {
  instance.unmount();
}, 50);
