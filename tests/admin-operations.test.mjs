import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/admin/staging/v031_operations.sql", "utf8");
const ui = readFileSync("src/components/StaffOperations.tsx", "utf8");
const staff = readFileSync("src/components/StaffPanel.tsx", "utf8");

test("advanced economy writes require AAL2 and server permissions", () => {
  for (const permission of ["economy.wallet.adjust","economy.treasury.adjust","economy.settings.manage","players.profile.edit"]) {
    assert.ok(sql.includes(permission));
  }
  assert.match(sql, /pg_advisory_xact_lock\(741029030\)/);
  assert.match(sql, /auth\.jwt\(\)->>'aal'/);
  assert.match(sql, /private\.staff_can\(permission_code,building\)/);
  assert.match(sql, /insert into private\.staff_audit/);
});

test("economic adjustments are ledger backed and have idempotency keys", () => {
  assert.match(sql, /private\.wallet_post\(/);
  assert.match(sql, /private\.treasury_post\(/);
  assert.match(sql, /operation_id uuid/);
  assert.match(sql, /new_balance<0/);
  assert.match(sql, /admin_adjustment/);
});

test("operational read masks balances outside authorized scope", () => {
  assert.match(sql, /case when private\.staff_can\('economy\.read',m\.building_id\)/);
  assert.match(sql, /then w\.balance else null end as balance/);
  assert.match(sql, /security definer set search_path=''/);
  assert.match(sql, /revoke all on function private\.staff_game_overview/);
});

test("UI uses RPC with confirmation and reason", () => {
  assert.ok(staff.includes("<StaffOperations identity={identity} />"));
  for (const rpc of ["staff_adjust_wallet","staff_adjust_treasury","staff_update_economy","staff_rename_player"]) {
    assert.ok(ui.includes(rpc));
  }
  assert.match(ui, /window\.confirm/);
  assert.match(ui, /reason\.trim\(\)/);
  assert.doesNotMatch(ui, /sb_secret_|service_role/);
});
