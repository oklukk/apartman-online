import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mfa = readFileSync("src/components/StaffMfa.tsx", "utf8");

test("interrupted MFA enrollment offers an explicit QR recovery action", () => {
  assert.match(mfa, /status === "unverified"/);
  assert.match(mfa, /mode === "pending"/);
  assert.match(mfa, /Yarım kalan kurulumu iptal et ve yeni QR oluştur/);
  assert.match(mfa, /await enrollNew\(\)/);
});

test("pending-factor recovery never removes a verified factor", () => {
  assert.match(mfa, /f\.id === factor && f\.factor_type === "totp" && f\.status === "unverified"/);
  assert.match(mfa, /supabase\.auth\.mfa\.unenroll\(\{ factorId: pending\.id \}\)/);
  assert.match(mfa, /if \(!pending\)/);
});

test("existing verified MFA still uses authenticator code instead of a new QR", () => {
  assert.match(mfa, /status === "verified"/);
  assert.match(mfa, /setMode\("verified"\)/);
  assert.match(mfa, /challengeAndVerify/);
  assert.match(mfa, /MFA kurulumu tek başına yönetici yetkisi vermez/);
});
