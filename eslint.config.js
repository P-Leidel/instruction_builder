import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // .claude/ holds agent-tooling scripts (e.g. the run-instruction-builder
  // skill's Playwright driver) that run under Node, not the browser - they
  // aren't part of the shipped app and don't need its lint rules.
  { ignores: ["dist", "node_modules", ".claude"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      // Preact's JSX runtime (jsxImportSource: "preact") means unused
      // React-style imports are never expected here.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Task 23: the hand-written service worker runs in its own global
    // scope (self/caches/clients), not a browser window - it's real
    // shipped code (unlike .claude/'s tooling scripts, ignored above), so
    // it still gets linted, just with the right globals for where it runs.
    files: ["public/sw.js"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
);
