// Vitest globalSetup -- runs once, in its own process, before every RLS
// test file. Creates the fixture rows once for the whole run rather than
// per-file (each test's own assertions run inside a rolled-back
// transaction -- see db-client.ts -- so the shared fixtures are never
// mutated by any individual test).
import { setupFixtures, teardownFixtures } from "./fixtures";
import { closePool } from "./db-client";

export async function setup(): Promise<void> {
  await setupFixtures();
}

export async function teardown(): Promise<void> {
  await teardownFixtures();
  await closePool();
}
