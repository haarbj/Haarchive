import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Separate from vitest.config.ts on purpose -- these tests need a real,
// running local Postgres instance (see tests/rls/README.md) and must never
// run as part of the ordinary `npm test`, which every contributor runs
// with no such database available. `npm run test:rls` is the only thing
// that points at this config.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    globalSetup: ["tests/rls/global-setup.ts"],
    // RLS tests share one Postgres connection pool per file and lean on
    // rolled-back transactions for isolation, not parallel workers racing
    // the same fixture rows.
    fileParallelism: false,
  },
});
