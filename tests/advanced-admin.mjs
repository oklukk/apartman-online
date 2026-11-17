import pg from "pg";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const base = "postgresql://postgres:local-test-only@127.0.0.1:55432/postgres";
const admin = new pg.Client({ connectionString: base });
await admin.connect();
await admin.query("create database apartman_advanced");
const url = new URL(base);
url.pathname = "/apartman_advanced";
const db = new pg.Client({ connectionString: url.href });
await db.connect();
let count = 0;
let prepared;
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
  await db.query("select private.run_v02()");
  await as(player, "select public.send_message('Korunan oyuncu sohbeti')");
  await db.query(
    "insert into public.polls(building_id,event_id) select $1,id from public.events where building_id=$1 limit 1",
    [b],
  );
  await db.query(
    "insert into public.votes(poll_id,user_id,choice) select id,$1,true from public.polls limit 1",
    [player],
  );
  await db.query(
    "insert into public.dues(building_id,user_id,week_start,amount) values($1,$2,date_trunc('week',now() at time zone 'Europe/Istanbul')::date,150)",
    [b, player],
  );
  const snapshot = () =>
    scalar(
      "select md5(string_agg(t||d,E'\n' order by t,d)) from (select 'wallet' t,row_to_json(w)::text d from public.wallets w union all select 'membership',row_to_json(m)::text from public.memberships m union all select 'building',row_to_json(x)::text from public.buildings x union all select 'election',row_to_json(e)::text from public.elections e union all select 'messages',row_to_json(m)::text from public.messages m union all select 'dues',row_to_json(d)::text from public.dues d union all select 'votes',row_to_json(v)::text from public.votes v union all select 'poll',row_to_json(p)::text from public.polls p union all select 'ledger',row_to_json(t)::text from public.wallet_transactions t) s",
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

  await db.query("insert into auth.mfa_factors values($1,'verified')", [owner]);
  await db.query("select private.staff_bootstrap($1,$2)", [
    owner,
    "Doğrulanmış test sahibi",
  ]);
  await grant(manager, "admin");
  await grant(mod, "moderator");
  await grant(editor, "editor");
  await db.query("create schema extensions");
  prepared = new pg.Client({ connectionString: url.href });
  await prepared.connect();
  await prepared.query("set role authenticated");
  await prepared.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [player, JSON.stringify({ sub: player, aal: "aal1" })],
  );
  await prepared.query(
    "prepare existing_player_action as select public.player_action('heartbeat')",
  );
  await prepared.query("execute existing_player_action");
  for (const f of files.slice(4))
    await db.query(await readFile("supabase/migrations/" + f, "utf8"));
  const uuid = () => crypto.randomUUID();
  const wallet = () =>
    scalar("select balance from public.wallets where user_id=$1", [player]);
  const cash = () =>
    scalar("select treasury from public.buildings where id=$1", [b]);
  const adjust = (u, amount, id = uuid(), aal = "aal2") =>
    as(
      u,
      "select public.staff_adjust_wallet($1,$2,$3,$4)",
      [player, amount, id, "Test para düzeltmesi"],
      aal,
    );
  const sanction = (act, until = null, u = owner, id = uuid()) =>
    as(u, "select public.staff_sanction($1,$2,$3,$4,$5)", [
      player,
      act,
      until,
      id,
      "Test yaptırım gerekçesi",
    ]);
  const state = async () =>
    (await as(owner, "select public.staff_governance_state($1)", [b])).rows[0]
      .staff_governance_state;
  const gov = async (act, args = {}, id = uuid(), u = owner, rev = null) => {
    const preview = await state();
    return as(u, "select public.staff_governance_action($1,$2,$3,$4,$5,$6)", [
      b,
      act,
      args,
      rev || preview.revision,
      id,
      "Test yönetim gerekçesi",
    ]);
  };
  await check(
    "Stage 1: wallet/treasury double clicks, payload conflicts, accounting and compensation",
    async () => {
      const start = await wallet(),
        id = uuid();
      await Promise.all([adjust(owner, 50, id), adjust(owner, 50, id)]);
      assert.equal(await wallet(), start + 50);
      await assert.rejects(() => adjust(owner, 51, id));
      await adjust(owner, -50);
      assert.equal(await wallet(), start);
      await assert.rejects(() => adjust(owner, -100000));
      await assert.rejects(() => adjust(mod, 10));
      await assert.rejects(() => adjust(owner, 10, uuid(), "aal1"));
      const prior = await cash(),
        tid = uuid();
      await as(owner, "select public.staff_adjust_treasury($1,100,$2,$3)", [
        b,
        tid,
        "Test kasa gerekçesi",
      ]);
      await as(owner, "select public.staff_adjust_treasury($1,100,$2,$3)", [
        b,
        tid,
        "Test kasa gerekçesi",
      ]);
      assert.equal(await cash(), prior + 100);
      await assert.rejects(() =>
        as(owner, "select public.staff_adjust_treasury($1,100,$2,$3)", [
          b,
          id,
          "Test kasa gerekçesi",
        ]),
      );
      assert.equal(
        await scalar(
          "select balance=(select sum(amount) from public.wallet_transactions where user_id=$1) from public.wallets where user_id=$1",
          [player],
        ),
        true,
      );
    },
  );
  await check(
    "Stage 1: rename/uniqueness, settings next-week only, audit old/new and scope",
    async () => {
      await as(owner, "select public.staff_rename_player($1,$2,$3,$4)", [
        player,
        "new_player",
        "Test yeni isim",
        uuid(),
      ]);
      await assert.rejects(() =>
        as(owner, "select public.staff_rename_player($1,$2,$3,$4)", [
          player,
          "rbac_0",
          "Test çakışan isim",
          uuid(),
        ]),
      );
      const debts = await scalar("select sum(amount) from public.dues");
      await as(
        owner,
        "select public.staff_update_economy($1,'weekly_dues',250,$2,$3)",
        [b, "Test aidat ayarı", uuid()],
      );
      assert.equal(await scalar("select sum(amount) from public.dues"), debts);
      await as(
        owner,
        "select public.staff_update_economy($1,'daily_salary',150,$2,$3)",
        [b, "Test maaş ayarı", uuid()],
      );
      assert.equal(
        await scalar(
          "select daily_salary from public.economy_settings where building_id=$1",
          [b],
        ),
        150,
      );
      await grant(custom, "admin", "building", b2);
      await assert.rejects(() => adjust(custom, 5));
      const history = (
        await as(owner, "select public.staff_operations_history($1)", [b])
      ).rows[0].staff_operations_history;
      assert.ok(
        history.some(
          (x) =>
            x.action === "wallet.adjust" &&
            x.old_value.balance !== x.new_value.balance,
        ),
      );
      await assert.rejects(() =>
        as(mod, "select public.staff_operations_history($1)", [b]),
      );
    },
  );
  await check(
    "Stage 1: compensations append one reverse entry and cannot repeat",
    async () => {
      const entry = await scalar(
          "select id from private.staff_audit where action='wallet.adjust' and (new_value->>'delta')::int=50 limit 1",
        ),
        id = uuid(),
        before = await wallet();
      await as(owner, "select public.staff_compensate($1,$2,$3)", [
        entry,
        id,
        "Test ters kayıt gerekçesi",
      ]);
      await as(owner, "select public.staff_compensate($1,$2,$3)", [
        entry,
        id,
        "Test ters kayıt gerekçesi",
      ]);
      assert.equal(await wallet(), before - 50);
      await assert.rejects(() =>
        as(owner, "select public.staff_compensate($1,$2,$3)", [
          entry,
          uuid(),
          "Tekrar telafi gerekçesi",
        ]),
      );
    },
  );
  await check(
    "Stage 1: future dues override actually used, existing debt preserved",
    async () => {
      await db.query(
        "insert into public.memberships(user_id,building_id,apartment_id) select $1,$2,id from public.apartments where building_id=$2 and number=3",
        [other, b],
      );
      await db.query(
        "update public.memberships set joined_at=now()-interval '15 days'",
      );
      await db.query(
        "update public.economy_settings set first_week=date_trunc('week',now() at time zone 'Europe/Istanbul')::date,dues_override_from=date_trunc('week',now() at time zone 'Europe/Istanbul')::date where building_id=$1",
        [b],
      );
      await db.query("select private.economy_tick($1)", [b]);
      assert.equal(
        await scalar("select amount from public.dues where user_id=$1", [
          other,
        ]),
        250,
      );
      assert.equal(
        await scalar("select amount from public.dues where user_id=$1", [
          player,
        ]),
        150,
      );
    },
  );
  await check(
    "Stage 2: mute blocks direct/private RPC chat, expiry/unmute and warnings preserved",
    async () => {
      await sanction("mute", null, mod);
      await assert.rejects(() =>
        as(player, "select public.send_message('blocked')"),
      );
      await assert.rejects(() =>
        as(player, "select private.send_message('blocked')"),
      );
      await as(player, "select public.player_action('heartbeat')");
      await sanction("unmute", null, mod);
      await db.query(
        "update public.memberships set last_message_at=null where user_id=$1",
        [player],
      );
      await as(player, "select public.send_message('allowed')");
      await sanction("mute", new Date(Date.now() + 60000).toISOString());
      await db.query(
        "update private.player_sanctions set expires_at=now()-interval '1 second' where user_id=$1 and revoked_at is null",
        [player],
      );
      await db.query(
        "update public.memberships set last_message_at=null where user_id=$1",
        [player],
      );
      await as(player, "select public.send_message('expired mute')");
      await sanction("warning");
      assert.ok(
        (
          await as(mod, "select public.staff_sanction_history($1)", [player])
        ).rows[0].staff_sanction_history.some((s) => s.kind === "warning"),
      );
    },
  );
  await check(
    "Stage 2: ban applies to active claims/all game writes; unban; permissions; hidden data",
    async () => {
      await assert.rejects(() => sanction("ban", null, mod));
      await sanction("ban");
      await assert.rejects(() =>
        prepared.query("execute existing_player_action"),
      );
      for (const [sql, args] of [
        ["select public.player_action('heartbeat')", []],
        ["select public.pay_dues($1)", [uuid()]],
        ["select public.send_message('ban bypass')", []],
        ["select public.cast_vote($1,true)", [uuid()]],
        ["select public.election_action($1,'vote',$2)", [uuid(), owner]],
        ["select public.propose_management('door')", []],
        ["select public.settle_polls()", []],
      ])
        await assert.rejects(() => as(player, sql, args));
      assert.equal(
        (await as(player, "select * from public.messages")).rowCount,
        0,
      );
      await sanction("unban");
      await as(player, "select public.player_action('heartbeat')");
      await assert.rejects(() =>
        as(owner, "select public.staff_sanction($1,'ban',null,$2,$3)", [
          owner,
          uuid(),
          "Son sahip korunur",
        ]),
      );
    },
  );
  await check(
    "Stage 2: temporary ban expiry, banned payroll suppression and no privilege escalation",
    async () => {
      await as(player, "select public.player_action('job','office')");
      await db.query(
        "update public.wallets set employment_started_on=(now() at time zone 'Europe/Istanbul')::date-1 where user_id=$1",
        [player],
      );
      await sanction("ban", new Date(Date.now() + 60000).toISOString());
      const balance = await wallet();
      await db.query("select private.economy_tick($1)", [b]);
      assert.equal(await wallet(), balance);
      await db.query(
        "update private.player_sanctions set expires_at=now()-interval '1 second' where user_id=$1 and kind='ban' and revoked_at is null",
        [player],
      );
      await db.query("select private.economy_tick($1)", [b]);
      assert.equal(await wallet(), balance + 150);
      await db.query("select private.economy_tick($1)", [b]);
      assert.equal(await wallet(), balance + 150);
    },
  );
  await check(
    "Stage 3: stale preview, unauthorized action, preserved old history and restart",
    async () => {
      await assert.rejects(() => gov("election.restart", {}, uuid(), mod));
      await assert.rejects(() =>
        gov("election.restart", {}, uuid(), owner, "stale"),
      );
      const n = await scalar("select count(*)::int from public.elections");
      await gov("election.restart");
      assert.equal(
        await scalar("select count(*)::int from public.elections"),
        n + 1,
      );
      const oldVotes = await scalar("select count(*)::int from public.votes");
      assert.equal(oldVotes, 1);
    },
  );
  await check(
    "Stage 3: normal votes resolve, direct appointment/term/dismissal, no overlapping terms",
    async () => {
      let e = await scalar(
        "select id from public.elections where status='nominations'",
      );
      await as(
        owner,
        "select public.election_action($1,'candidate','Test adaylığı')",
        [e],
      );
      await db.query(
        "update public.elections set starts_at=now()-interval '25 hours',nominations_end=now()-interval '1 hour' where id=$1",
        [e],
      );
      await as(owner, "select public.election_action($1,'vote',$2)", [
        e,
        owner,
      ]);
      await as(player, "select public.election_action($1,'vote',$2)", [
        e,
        owner,
      ]);
      await gov("election.resolve", { election_id: e });
      assert.equal(
        await scalar("select status from public.elections where id=$1", [e]),
        "elected",
      );
      await gov("manager.appoint", { user_id: player });
      assert.equal(
        await scalar("select private.current_manager($1)", [b]),
        player,
      );
      const term = await scalar(
        "select id from public.manager_terms where user_id=$1 and ends_at>now() and not voided",
        [player],
      );
      await gov("manager.term", {
        term_id: term,
        ends_at: new Date(Date.now() + 86400000 * 20).toISOString(),
      });
      await gov("manager.dismiss");
      assert.equal(
        await scalar("select private.current_manager($1)", [b]),
        null,
      );
      await gov("election.start");
      e = await scalar(
        "select id from public.elections where status='nominations'",
      );
      await as(
        player,
        "select public.election_action($1,'candidate','İkinci aday')",
        [e],
      );
      await gov("election.force", { election_id: e, user_id: player });
      assert.equal(
        await scalar("select status from public.elections where id=$1", [e]),
        "elected",
      );
    },
  );
  await check(
    "Stage 3: forced poll never invents votes or double-spends, respects budget",
    async () => {
      const p = await scalar("select id from public.polls where status='open'");
      const before = await cash(),
        id = uuid(),
        r = (await state()).revision;
      await gov("poll.force_accept", { poll_id: p }, id, owner, r);
      await gov("poll.force_accept", { poll_id: p }, id, owner, r);
      assert.equal(await cash(), before - 1200);
      assert.equal(await scalar("select count(*)::int from public.votes"), 1);
      await assert.rejects(() => gov("poll.force_accept", { poll_id: p }));
      assert.equal(
        await scalar(
          "select count(*)::int from public.treasury_transactions where poll_id=$1",
          [p],
        ),
        1,
      );
    },
  );
  await check(
    "Scheduler and admin use one building lock; restrictions cannot be bypassed through renamed bodies",
    async () => {
      const c = new pg.Client({ connectionString: url.href });
      await c.connect();
      await c.query("begin");
      await c.query("select 1 from public.buildings where id=$1 for update", [
        b,
      ]);
      const tick = db.query("select private.run_v02()");
      await new Promise((r) => setTimeout(r, 50));
      await c.query("commit");
      await tick;
      await c.end();
      await assert.rejects(() =>
        as(
          player,
          "select private.player_action_before_moderation('heartbeat')",
        ),
      );
      assert.equal(
        await scalar(
          "select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef",
        ),
        0,
      );
    },
  );
  await check(
    "Stage 3: reschedule/cancel preserve ballots, forced budget fails safely",
    async () => {
      await gov("election.start");
      const e = await scalar(
        "select id from public.elections where status='nominations'",
      );
      const now = Date.now();
      await gov("election.schedule", {
        election_id: e,
        nominations_end: new Date(now + 3600000).toISOString(),
        voting_end: new Date(now + 7200000).toISOString(),
      });
      await gov("election.cancel", { election_id: e });
      assert.equal(
        await scalar("select status from public.elections where id=$1", [e]),
        "failed",
      );
      await db.query(
        "insert into public.events(building_id,kind,title,description,cost) values($1,'expensive_fixture','Test','Test',999999)",
        [b],
      );
      await db.query(
        "insert into public.polls(building_id,event_id) select $1,id from public.events where kind='expensive_fixture'",
        [b],
      );
      const p = await scalar(
        "select p.id from public.polls p join public.events e on e.id=p.event_id where e.kind='expensive_fixture'",
      );
      const money = await cash();
      await assert.rejects(() => gov("poll.force_accept", { poll_id: p }));
      assert.equal(await cash(), money);
      assert.equal(
        await scalar("select status from public.polls where id=$1", [p]),
        "open",
      );
      await gov("poll.force_reject", { poll_id: p });
    },
  );
  await check(
    "Stage 3: cron/admin concurrency and database term exclusion",
    async () => {
      await Promise.all([
        gov("election.restart"),
        db.query("select private.run_v02()"),
      ]);
      assert.equal(
        await scalar(
          "select count(*)::int from public.elections where status in ('nominations','voting')",
        ),
        1,
      );
      const n = await scalar("select count(*)::int from public.manager_terms");
      await assert.rejects(() =>
        db.query(
          "insert into public.manager_terms(building_id,user_id,starts_at,ends_at) values($1,$2,now(),now()+interval '14 days')",
          [b, owner],
        ),
      );
      assert.equal(
        await scalar("select count(*)::int from public.manager_terms"),
        n,
      );
    },
  );
  console.log(
    `${count} advanced administration integration groups passed. Disposable PostgreSQL only.`,
  );
} finally {
  if (prepared) await prepared.end();
  await db.end();
  await admin.query("drop database apartman_advanced with (force)");
  await admin.end();
}
