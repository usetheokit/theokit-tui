import { Box, Text, render } from "ink";

import {
  Banner,
  TheoTUIProvider,
  VERSION,
  WelcomeBanner,
  renderFigletArt,
} from "../src/index.js";

// Banner demos (plan m9 WelcomeBanner + m27 <Banner>): the startup header every
// agent CLI mounts first. Piped (non-TTY) stdout is the EC-2 environment by
// construction — columns undefined → width fallback 60. M12: `animated` opts into
// the < 2 s reveal on an interactive terminal; piped runs stay on the static path.
//
// M27 <Banner> banner layout (piped, `pnpm example:banner | cat`):
//   ___          _
//  |_   _|_ _  ___| |__  ___
//    | | | ' \/ -_) '_ \/ _ \
//    |_| |_||_\___|_.__/\___/
//  ╭────────────────────────────╮
//  │ model theo-demo-1           │
//  │ cwd   ~/projects/app        │
//  ╰────────────────────────────╯
const THEO_ART = [
  "  ___          _",
  " |_   _|_ _  ___| |__  ___",
  "   | | | ' \\/ -_) '_ \\/ _ \\",
  "   |_| |_||_\\___|_.__/\\___/",
].join("\n");

// The real integration pattern: generate the art from text via the OPTIONAL
// `figlet` peer, and fall back to a ready art string when figlet is not
// installed (`renderFigletArt` returns null). With no figlet in this repo, the
// fallback wins — install `figlet` to see the generated 400-font art instead.
const ART = (await renderFigletArt("Theo", "Standard")) ?? THEO_ART;

function Demo() {
  return (
    <TheoTUIProvider>
      <Box flexDirection="column" gap={1}>
        <WelcomeBanner
          name="Theo TUI"
          version={VERSION}
          animated
          tagline="AI-agent primitives for the terminal"
          hints={[
            "/help for commands",
            "esc to cancel a running turn",
            "docs: github.com/usetheodev/theokit-tui",
          ]}
        >
          <Text dimColor>cwd: ~/projects/demo</Text>
        </WelcomeBanner>
        {/* M27: the <Banner> banner layout — ASCII-art logo + framed status box.
            `ART` is generated via renderFigletArt (optional figlet peer) with a
            ready-string fallback when figlet is absent — see the top of the file. */}
        <Banner
          name="Theo TUI"
          version={VERSION}
          art={ART}
          layout="banner"
          status={[
            { label: "model", value: "theo-demo-1" },
            { label: "cwd", value: "~/projects/app" },
          ]}
        />
      </Box>
    </TheoTUIProvider>
  );
}

const instance = render(<Demo />);
// House shape (plan EC-5): every smoke-tested example unmounts explicitly.
// M12: on an interactive terminal the reveal needs its 0.96 s script —
// piped smoke runs keep the fast 50 ms exit (static path by gate).
const exitDelayMs = process.stdout.isTTY ? 1500 : 50;
setTimeout(() => {
  instance.unmount();
}, exitDelayMs);
