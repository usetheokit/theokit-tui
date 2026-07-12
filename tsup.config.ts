import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/renderer/index.ts", "src/ai-sdk/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
});
