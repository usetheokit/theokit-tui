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
  // `.cjs` files are CommonJS, and `module` is a global there. Without this, eslint's
  // `no-undef` fires on `module.exports` in `.dependency-cruiser.cjs`.
  //
  // Found by CI, not locally, and the reason is worth keeping: `lint` reads `git ls-files`, so a
  // file that is not yet in the index is not linted. A local `pnpm gates` before `git add` covers
  // every file EXCEPT the new one — which is usually the only one worth linting. That is the
  // index-scoped gate (B-051) behaving exactly as designed; the gap is in when it is run.
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
      },
    },
  },
);
