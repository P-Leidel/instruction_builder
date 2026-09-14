import { defineConfig } from "vitest/config";

// Standalone from vite.config.ts on purpose: that file only configures the
// app's own build/dev-server and the Preact JSX plugin, neither of which
// this pass's test scope needs (plain .ts unit tests, no .tsx rendering) -
// see docs/phase-2/plans/task-20-automated-testing-plan.md for the scope this
// reflects.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
