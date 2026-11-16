import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const sql = readFileSync(
  "supabase/admin/staging/v03_rbac_foundation.sql",
  "utf8",
);
const ui = readFileSync("src/components/StaffPanel.tsx", "utf8");
const app = readFileSync("src/main.tsx", "utf8");

test("four built-in roles and extensible tables exist", () => {
  for (const role of ["super_admin", "admin", "moderator", "editor"])
    assert.ok(sql.includes("'" + role + "'"));
  for (const table of [
    "staff_roles",
    "staff_permissions",
    "staff_role_permissions",
    "staff_assignments",
    "staff_audit",
  ]) {
    assert.ok(sql.includes("create table private." + table));
  }
});
test("sensitive server operations check privilege and record audit", () => {
  assert.ok(sql.includes("security definer set search_path=''"));
  assert.ok(sql.includes("private.staff_is_super()"));
  assert.ok(
    sql.includes("private.staff_can('world.buildings.rename',target_building)"),
  );
  assert.ok(sql.includes("alter table private.%I enable row level security"));
  assert.ok(sql.includes("Çok faktörlü doğrulama gerekli."));
});
test("staff UI uses RPC and is gated by server role discovery", () => {
  assert.ok(app.includes("staff.roles.length > 0"));
  assert.ok(app.includes("<StaffPanel identity={staff} />"));
  for (const rpc of [
    "staff_me",
    "staff_grant",
    "staff_revoke",
    "staff_create_role",
  ])
    assert.ok(ui.includes(rpc));
  assert.doesNotMatch(ui, /service_role|sb_secret_/);
});

test("staging matches canonical migration and bootstrap is never invoked", () => {
  const file = readdirSync("supabase/migrations").find((f) =>
    f.endsWith("_v03_admin_rbac_foundation.sql"),
  );
  assert.ok(file);
  assert.equal(readFileSync("supabase/migrations/" + file, "utf8"), sql);
  assert.doesNotMatch(sql, /select private\.staff_bootstrap\(/i);
});

test("account security permits MFA onboarding before staff bootstrap", () => {
  assert.ok(app.includes('tab === "Güvenlik"'));
  assert.ok(app.includes('<StaffMfa />'));
  assert.ok(app.includes('Hesap güvenliği'));
  assert.ok(app.includes('Doğrulamayı etkinleştirmek yönetim yetkisi vermez.'));
  assert.ok(app.includes('tab === "Sistem" && staff.roles.length > 0'));
});
