import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // tests/rls/** needs a real local Postgres instance (see
    // tests/rls/README.md) and runs only via `npm run test:rls`, never as
    // part of the ordinary suite every contributor runs with no such
    // database available.
    exclude: ["**/node_modules/**", "tests/rls/**"],
  },
});
