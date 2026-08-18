import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Standalone ignores object — adding any other key would make it file-scoped
  // and silently un-ignore dist/ (SEPA iteration-2 finding).
  //
  // `modelo/` is a NESTED FOREIGN CHECKOUT: TheoCode is its own repository, with its own eslint
  // config and its own conventions, kept here to be read and co-evolved. Linting it reported 1084
  // problems this repository cannot fix and must not rewrite — and since `npm run lint` is
  // `eslint .`, that turned the repo's own gate red over a directory that is not part of it.
  // Same shape as the `no-ptbr` sweep reaching into it, and it is ignored for the same reason.
  {
    ignores: [
      "dist/",
      "coverage/",
      "benchmarks/baselines/",
      ".claude/",
      "modelo/",
    ],
  },
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
