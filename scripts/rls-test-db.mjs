#!/usr/bin/env node
// Setup/teardown for the local Postgres instance tests/rls/*.test.ts run
// against -- see tests/rls/README.md for the full explanation of why this
// exists instead of `supabase start` (Docker-based, unavailable in some
// environments this project is developed in). Deliberately a standalone
// script, not folded into a test's own beforeAll: the cluster needs to
// survive across multiple `vitest run` invocations while iterating, and
// "up"/"down" are operationally different actions (init a data directory
// vs. start/stop a process) than anything a test file should be
// responsible for.
//
// Usage:
//   node scripts/rls-test-db.mjs up      # init (if needed) + start + bootstrap + apply all migrations
//   node scripts/rls-test-db.mjs down    # stop the server (data persists)
//   node scripts/rls-test-db.mjs reset   # down, wipe the data directory, up

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PGDATA = path.join(REPO_ROOT, ".rls-test-db", "pgdata");
const LOGFILE = path.join(REPO_ROOT, ".rls-test-db", "postgres.log");
const PORT = "55432";
const DB_NAME = "haarchive_rls_test";
const PG_BIN = "/opt/homebrew/opt/postgresql@17/bin";

const env = { ...process.env, PATH: `${PG_BIN}:${process.env.PATH}`, LC_ALL: "en_US.UTF-8" };

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { env, encoding: "utf8", ...opts });
}

function up() {
  if (!existsSync(PGDATA)) {
    console.log("Initializing PGDATA...");
    run("initdb", ["--locale=en_US.UTF-8", "-E", "UTF-8", "-U", "postgres", "-D", PGDATA]);
  }

  console.log("Starting Postgres...");
  try {
    run("pg_ctl", ["-D", PGDATA, "-o", `-p ${PORT} -k /tmp`, "-l", LOGFILE, "start"]);
  } catch (error) {
    console.error("Postgres failed to start -- see", LOGFILE);
    throw error;
  }

  console.log("Creating database (if needed)...");
  try {
    run("createdb", ["-h", "/tmp", "-p", PORT, "-U", "postgres", DB_NAME]);
  } catch {
    // Already exists -- fine, this is meant to be safely re-runnable.
  }

  console.log("Applying bootstrap.sql...");
  const psqlBase = ["-h", "/tmp", "-p", PORT, "-U", "postgres", "-d", DB_NAME, "-v", "ON_ERROR_STOP=1"];
  try {
    run("psql", [...psqlBase, "-f", path.join(REPO_ROOT, "tests/rls/bootstrap.sql")]);
  } catch {
    console.log("(bootstrap already applied -- continuing)");
  }

  console.log("Applying migrations...");
  const migrationsDir = path.join(REPO_ROOT, "supabase/migrations");
  const files = execFileSync("bash", ["-c", `ls ${migrationsDir}/*.sql`], { encoding: "utf8" }).trim().split("\n");
  for (const file of files) {
    try {
      run("psql", [...psqlBase, "-f", file]);
    } catch (error) {
      // Idempotent re-run: a migration already applied in a prior `up`
      // fails with "already exists" -- expected, not a real failure. Any
      // OTHER error (a genuine syntax/logic problem) is re-thrown, not
      // silently swallowed -- this is exactly the check this harness
      // exists to run ("do these migrations actually apply as written"),
      // so hiding a real failure here would defeat the point.
      const output = String(error.stdout ?? "") + String(error.stderr ?? "");
      if (/already exists/i.test(output)) {
        console.log(`  (already applied: ${path.basename(file)})`);
        continue;
      }
      console.error(`Migration failed: ${file}`);
      console.error(output);
      throw error;
    }
  }
  console.log(`Ready: postgres://postgres@127.0.0.1:${PORT}/${DB_NAME}`);
}

function down() {
  if (!existsSync(PGDATA)) {
    console.log("No PGDATA directory -- nothing to stop.");
    return;
  }
  try {
    run("pg_ctl", ["-D", PGDATA, "stop", "-m", "fast"]);
  } catch {
    console.log("(server was not running)");
  }
}

function reset() {
  down();
  rmSync(path.join(REPO_ROOT, ".rls-test-db"), { recursive: true, force: true });
  up();
}

const action = process.argv[2];
if (action === "up") up();
else if (action === "down") down();
else if (action === "reset") reset();
else {
  console.error("Usage: node scripts/rls-test-db.mjs <up|down|reset>");
  process.exit(1);
}
