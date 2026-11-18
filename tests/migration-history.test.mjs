import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";

const directory = "supabase/migrations";
const canonical = [
  "20261115141348_initial_game.sql",
  "20261115141400_scheduled_resolution.sql",
  "20261115185834_v02_economy_governance.sql",
  "20261116134945_v03_admin_rbac_foundation.sql",
  "20261118203012_v031_staff_economy.sql",
  "20261118203040_v032_moderation.sql",
  "20261118203100_v033_governance_operations.sql",
];

test("repository migration versions match the already-applied production history", async () => {
  const files = (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(files.slice(0, canonical.length), canonical);
  assert.equal(new Set(files.map((name) => name.slice(0, 14))).size, files.length);
  assert.ok(files.every((name) => /^\d{14}_[a-z][a-z0-9_]*\.sql$/.test(name)));
});

test("canonical v031 SQL still matches the reviewed staging copy byte-for-byte", async () => {
  const [canonicalV031, staging] = await Promise.all([
    readFile(`${directory}/20261118203012_v031_staff_economy.sql`, "utf8"),
    readFile("supabase/admin/staging/v031_operations.sql", "utf8"),
  ]);
  assert.equal(canonicalV031, staging);
});
