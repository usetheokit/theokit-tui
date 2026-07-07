import { Box, render } from "ink";

import { CodeBlock, DiffViewer, TheoTUIProvider } from "../src/index.js";
import { ensureHighlighter } from "../src/code-block.js";

// Code-surface demo (plan T3.2 — TTFATT caller): a unified diff + a
// highlighted code block. Non-TTY-safe by design: the scene is static, so
// piped output is clean; we await the optional highlighter once so the
// single rendered frame is the highlighted one.
const patch = [
  "--- a/greet.ts",
  "+++ b/greet.ts",
  "@@ -1,5 +1,6 @@",
  " export function greet(name: string) {",
  "-  return `hi ${name}`;",
  "+  const greeting = `hello ${name}`;",
  "+  return greeting;",
  " }",
  " // callers unchanged",
  "",
].join("\n");

const snippet = ['const result = greet("theo");', "console.log(result);"].join(
  "\n",
);

await ensureHighlighter();

const instance = render(
  <TheoTUIProvider>
    <Box flexDirection="column">
      <DiffViewer patch={patch} />
      <CodeBlock code={snippet} language="typescript" showLineNumbers />
    </Box>
  </TheoTUIProvider>,
);
setTimeout(() => {
  instance.unmount();
}, 50);
