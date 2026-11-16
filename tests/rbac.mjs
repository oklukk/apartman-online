import pg from "pg";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const base = "postgresql://postgres:local-test-only@127.0.0.1:55432/postgres";
const admin = new pg.Client({ connectionString: base });
await admin.connect();
await admin.query("create database apartman_rbac");
const url = new URL(base);
url.pathname = "/apartman_rbac";
const db = new pg.Client({ connectionString: url.href });
await db.connect();
let count = 0;
async function as(u, sql, args = [], aal = "aal2") {
  const c = new pg.Client({ connectionString: url.href });
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [
        u,
        JSON.stringify({
          sub: u,
          aal,
          user_metadata: { role: "super_admin", aal: "aal2" },
        }),
      ],
    );
    const r = await c.query(sql, args);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    await c.end();
  }
}
const scalar = async (sql, args = []) =>
  Object.values((await db.query(sql, args)).rows[0])[0];
const check = async (name, f) => {
  await f();
  count++;
  console.log("PASS", name);
};
try {
  for (const role of ["anon", "authenticated", "service_role"])
    if (
      !(await admin.query("select 1 from pg_roles where rolname=$1", [role]))
        .rowCount
    )
      await admin.query(`create role ${role} nologin`);
  await db.query(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);create table auth.mfa_factors(user_id uuid references auth.users,status text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid(),auth.jwt() to authenticated,anon;create publication supabase_realtime;`);
  const files = (await readdir("supabase/migrations")).sort();
  for (const f of files.slice(0, 3)) {
    let s = await readFile("supabase/migrations/" + f, "utf8");
    s = s
      .replace(
        /create extension if not exists pg_cron with schema pg_catalog;/g,
        "",
      )
      .replace(/select cron\.schedule\([^;]+;/g, "");
    await db.query(s);
  }
  const users = Array.from({ length: 8 }, () => crypto.randomUUID());
  const [owner, other, manager, mod, editor, custom, player, outsider] = users;
  for (const [i, u] of users.entries())
    await db.query("insert into auth.users values($1,$2,now())", [
      u,
      { username: "rbac_" + i },
    ]);
  const b = await scalar("select id from public.buildings where slug='cinar'");
  const b2 = await scalar(
    "insert into public.buildings(slug,name) values('fixture2','Test Bina') returning id",
  );
  for (const [i, u] of [owner, player].entries())
    await db.query(
      "insert into public.memberships(user_id,building_id,apartment_id) select $1,$2,id from public.apartments where building_id=$2 and number=$3",
      [u, b, i + 1],
    );
  const snapshot = () =>
    scalar(
      "select md5(string_agg(t||d,E'\n' order by t,d)) from (select 'wallet' t,row_to_json(w)::text d from public.wallets w union all select 'membership',row_to_json(m)::text from public.memberships m union all select 'building',row_to_json(x)::text from public.buildings x union all select 'election',row_to_json(e)::text from public.elections e) s",
    );
  const before = await snapshot();
  await db.query(await readFile("supabase/migrations/" + files[3], "utf8"));
  const me = async (u) =>
    (await as(u, "select public.staff_me()")).rows[0].staff_me;
  const grant = (u, role, scope = "global", id = null, aal = "aal2") =>
    as(
      owner,
      "select public.staff_grant($1,$2,$3,$4,$5)",
      [u, role, scope, id, "Test yetki gerekçesi"],
      aal,
    );
  const create = (code, perms) =>
    as(owner, "select public.staff_create_role($1,$2,$3,$4,$5)", [
      code,
      "Özel rol",
      "",
      perms,
      "Test rol gerekçesi",
    ]);
  const rename = (u, id = b, aal = "aal2") =>
    as(
      u,
      "select public.staff_rename_building($1,$2,$3)",
      [id, "Yeni apartman adı", "Test ad gerekçesi"],
      aal,
    );
  const assignment = async (u, role) =>
    scalar(
      "select a.id from private.staff_assignments a join private.staff_roles r on r.id=a.role_id where a.user_id=$1 and r.code=$2",
      [u, role],
    );
  await check(
    "Migration leaves v0.2 state untouched and creates no automatic super",
    async () => {
      assert.equal(before, await snapshot());
      assert.equal(
        await scalar("select count(*)::int from private.staff_assignments"),
        0,
      );
      assert.deepEqual((await me(player)).roles, []);
    },
  );
  await check(
    "Unprivileged and forged metadata cannot call protected APIs",
    async () => {
      await assert.rejects(() => rename(player));
      await assert.rejects(() => grant(other, "admin", "global", null, "aal1"));
      await assert.rejects(() => as(player, "select public.staff_directory()"));
      await assert.rejects(() =>
        as(player, "select * from private.staff_roles"),
      );
      await assert.rejects(() =>
        as(player, "select private.staff_can('world.buildings.rename',$1)", [
          b,
        ]),
      );
      await assert.rejects(() =>
        as(player, "select private.staff_bootstrap($1,$2)", [
          player,
          "Test gerekçe",
        ]),
      );
    },
  );
  await check(
    "Bootstrap requires verified owner email and enrolled MFA, only DB owner",
    async () => {
      await assert.rejects(() =>
        db.query("select private.staff_bootstrap($1,$2)", [
          owner,
          "Test gerekçe",
        ]),
      );
      await db.query("insert into auth.mfa_factors values($1,'verified')", [
        owner,
      ]);
      await db.query(
        "update auth.users set email_confirmed_at=null where id=$1",
        [owner],
      );
      await assert.rejects(() =>
        db.query("select private.staff_bootstrap($1,$2)", [
          owner,
          "Test gerekçe",
        ]),
      );
      await db.query(
        "update auth.users set email_confirmed_at=now() where id=$1",
        [owner],
      );
      await db.query("select private.staff_bootstrap($1,$2)", [
        owner,
        "Doğrulanmış test sahibi",
      ]);
      await assert.rejects(() =>
        db.query("select private.staff_bootstrap($1,$2)", [
          other,
          "Tekrar gerekçe",
        ]),
      );
    },
  );
  await check(
    "Every authority edit needs AAL2 (including custom roles and delegation)",
    async () => {
      await assert.rejects(() =>
        grant(manager, "admin", "global", null, "aal1"),
      );
      await assert.rejects(() =>
        as(
          owner,
          "select public.staff_create_role('bypass','Bypass','',array['world.buildings.rename'],'Test gerekçe')",
          [],
          "aal1",
        ),
      );
      await assert.rejects(() => rename(owner, b, "aal1"));
      await assert.rejects(() =>
        as(
          owner,
          "select public.staff_set_role_permissions('editor',array['staff.roles.manage'],'Test gerekçe')",
          [],
          "aal1",
        ),
      );
    },
  );
  await check(
    "Built-in admin/moderator/editor are least privilege and union works",
    async () => {
      await grant(manager, "admin");
      await grant(mod, "moderator");
      await grant(editor, "editor");
      await rename(manager);
      await assert.rejects(() => rename(mod));
      await assert.rejects(() => rename(editor));
      await grant(mod, "editor");
      assert.equal((await me(mod)).roles.length, 2);
      assert.ok((await me(mod)).permissions.includes("players.moderate"));
      assert.ok((await me(mod)).permissions.includes("content.events.manage"));
    },
  );
  await check(
    "Custom role, duplicate grants, live permission edits and revocation",
    async () => {
      await create("custom_test", ["world.buildings.rename"]);
      await grant(custom, "custom_test");
      await grant(custom, "custom_test");
      assert.equal((await me(custom)).roles.length, 1);
      await rename(custom);
      await as(
        owner,
        "select public.staff_set_role_permissions('custom_test',array['world.buildings.read'],'Test gerekçe')",
      );
      await assert.rejects(() => rename(custom));
      await as(owner, "select public.staff_revoke($1,$2)", [
        await assignment(custom, "custom_test"),
        "Test iptal gerekçesi",
      ]);
      assert.equal((await me(custom)).roles.length, 0);
    },
  );
  await check(
    "Scoped access works only in granted building, directory never leaks other buildings or users",
    async () => {
      await grant(custom, "admin", "building", b);
      await rename(custom, b);
      await assert.rejects(() => rename(custom, b2));
      const d = (await as(custom, "select public.staff_directory()")).rows[0]
        .staff_directory;
      assert.equal(d.buildings.length, 1);
      assert.deepEqual(d.users, []);
      assert.deepEqual(d.assignments, []);
      assert.deepEqual(d.audit, []);
      assert.equal((await me(custom)).scoped_permissions[0].building_id, b);
    },
  );
  await check(
    "Global role reader cannot read audit without audit permission",
    async () => {
      await create("reader_only", ["staff.roles.read"]);
      await grant(outsider, "reader_only");
      const d = (await as(outsider, "select public.staff_directory()")).rows[0]
        .staff_directory;
      assert.deepEqual(d.audit, []);
      assert.ok(d.roles.length >= 4);
    },
  );
  await check(
    "Expiry immediate, unknown permissions/nulls rejected, nonexistent scope rejected",
    async () => {
      await db.query(
        "update private.staff_assignments set expires_at=now()-interval '1 second' where user_id=$1",
        [custom],
      );
      await assert.rejects(() => rename(custom));
      await assert.rejects(() => create("invalid_perm", ["not.a.permission"]));
      await assert.rejects(() =>
        grant(custom, "admin", "building", crypto.randomUUID()),
      );
      await assert.rejects(() => grant(custom, "super_admin", "building", b));
    },
  );
  await check(
    "Last super protected in RPC, direct expiry and auth user deletion",
    async () => {
      await assert.rejects(async () =>
        as(owner, "select public.staff_revoke($1,$2)", [
          await assignment(owner, "super_admin"),
          "Son yetki iptali",
        ]),
      );
      await assert.rejects(() =>
        db.query(
          "update private.staff_assignments set expires_at=now() where user_id=$1",
          [owner],
        ),
      );
      await assert.rejects(() =>
        db.query("delete from auth.users where id=$1", [owner]),
      );
    },
  );
  await check(
    "Revoked authority cannot survive waiting on the write lock",
    async () => {
      const c = new pg.Client({ connectionString: url.href });
      await c.connect();
      await c.query("begin");
      await c.query("select pg_advisory_xact_lock(741029030)");
      const pending = rename(manager).then(
        () => true,
        () => false,
      );
      try {
        let waiting = false;
        for (let i = 0; i < 80; i++) {
          waiting = await scalar(
            "select exists(select 1 from pg_stat_activity where wait_event='advisory' and query like '%public.staff_rename_building%')",
          );
          if (waiting) break;
          await new Promise((r) => setTimeout(r, 25));
        }
        assert.ok(waiting);
        await c.query(
          "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
          [owner, JSON.stringify({ sub: owner, aal: "aal2" })],
        );
        await c.query("set local role authenticated");
        await c.query("select public.staff_revoke($1,$2)", [
          await assignment(manager, "admin"),
          "Eşzamanlı yetki iptali",
        ]);
        await c.query("commit");
        assert.equal(await pending, false);
      } finally {
        await c.query("rollback");
        await c.end();
      }
    },
  );
  await check(
    "Concurrent supers cannot remove both or retain authority after revocation",
    async () => {
      await grant(other, "super_admin");
      const a1 = await assignment(owner, "super_admin"),
        a2 = await assignment(other, "super_admin");
      const results = await Promise.allSettled([
        as(owner, "select public.staff_revoke($1,$2)", [a2, "Eşzamanlı iptal"]),
        as(other, "select public.staff_revoke($1,$2)", [a1, "Eşzamanlı iptal"]),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        await scalar(
          "select count(*)::int from private.staff_assignments a join private.staff_roles r on r.id=a.role_id where r.code='super_admin'",
        ),
        1,
      );
    },
  );
  await check(
    "RLS enabled, audit append protected, public functions invoker",
    async () => {
      assert.equal(
        await scalar(
          "select count(*)::int from pg_tables where schemaname='private' and tablename like 'staff_%' and not rowsecurity",
        ),
        0,
      );
      await assert.rejects(() =>
        as(manager, "delete from private.staff_audit"),
      );
      assert.equal(
        await scalar(
          "select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'staff_%' and prosecdef",
        ),
        0,
      );
      assert.ok(
        (await scalar("select count(*)::int from private.staff_audit")) > 5,
      );
    },
  );
  await check(
    "Future registered permissions inherit for super; failed writes are atomic; anon RPC denied",
    async () => {
      const survivor = await scalar(
        "select a.user_id from private.staff_assignments a join private.staff_roles r on r.id=a.role_id where r.code='super_admin'",
      );
      await db.query(
        "insert into private.staff_permissions values('future.module.run','Test','Yeni modül','')",
      );
      assert.ok((await me(survivor)).permissions.includes("future.module.run"));
      const before = await scalar(
        "select count(*)::int from private.staff_audit",
      );
      await assert.rejects(() =>
        as(
          survivor,
          "select public.staff_set_role_permissions('editor',array['bad.permission'],'Test gerekçe')",
        ),
      );
      assert.equal(
        await scalar("select count(*)::int from private.staff_audit"),
        before,
      );
      assert.equal(
        await scalar(
          "select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'staff_%' and has_function_privilege('anon',p.oid,'execute')",
        ),
        0,
      );
    },
  );
  console.log(
    `${count} real PostgreSQL RBAC integration groups passed. No live changes; JWT/AAL fixture is not a real MFA ceremony.`,
  );
} finally {
  await db.end();
  await admin.query("drop database apartman_rbac with (force)");
  await admin.end();
}
