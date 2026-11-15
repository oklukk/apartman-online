import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("Pages alt dizini ve Türkçe belge", async () => {
  assert.match(
    await readFile("vite.config.ts", "utf8"),
    /base: ["']\/apartman-online\/["']/,
  );
  assert.match(await readFile("index.html", "utf8"), /lang="tr"/);
});
test("İstemci yalnızca publishable yapılandırmayı kullanır", async () => {
  const source = await readFile("src/api.ts", "utf8");
  assert.match(source, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(source, /service_role|sb_secret_/);
});
test("Yayın iş akışı derleme ve testten geçer", async () => {
  const yml = await readFile(".github/workflows/pages.yml", "utf8");
  assert.match(yml, /npm ci/);
  assert.match(yml, /npm test/);
  assert.match(yml, /npm run build/);
  assert.match(yml, /needs:.*build/);
});
