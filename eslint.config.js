import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Standalone ignores object — adding any other key would make it file-scoped
  // and silently un-ignore dist/ (SEPA iteration-2 finding).
  { ignores: ["dist/", "coverage/", "benchmarks/baselines/", ".claude/"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs["recommended-latest"],
  {
    rules: {
      // Plan T0.2 acceptance criterion oracle — without the explicit rule the
      // "complexity <= 10" gate would be vacuously green (SEPA finding 6).
      complexity: ["error", 10],
    },
  },
);
