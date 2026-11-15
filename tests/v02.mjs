// NEVER hosted: fixed disposable localhost database. Runs after (or independently of) legacy SQL tests.
import pg from "pg";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const url = "postgresql://postgres:local-test-only@127.0.0.1:55432/postgres";
const admin = new pg.Client({ connectionString: url });
await admin.connect();
await admin.query("create database apartman_v02");
const testUrl = new URL(url);
testUrl.pathname = "/apartman_v02";
const connectionString = testUrl.href;
const db = new pg.Client({ connectionString });
await db.connect();
let count = 0;
const check = async (name, fn) => {
  await fn();
  console.log("PASS", name);
  count++;
};
async function as(u, sql, args = []) {
  const c = new pg.Client({ connectionString });
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [u]);
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
const balance = async (u) =>
  scalar("select balance from public.wallets where user_id=$1", [u]);
const cash = async () => scalar("select treasury from public.buildings");
const action = (u, act, value = null) =>
  as(u, "select public.player_action($1,$2)", [act, value]);
try {
  for (const role of ["anon", "authenticated"])
    if (
      !(await admin.query("select 1 from pg_roles where rolname=$1", [role]))
        .rowCount
    )
      await admin.query(`create role ${role} nologin`);
  await db.query(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create publication supabase_realtime;`);
  const files = (await readdir("supabase/migrations")).sort();
  await db.query(await readFile("supabase/migrations/" + files[0], "utf8"));
  const cron = await readFile("supabase/migrations/" + files[1], "utf8");
  await db.query(
    cron.slice(
      cron.indexOf("create function"),
      cron.indexOf("select cron.schedule"),
    ),
  );
  const a = crypto.randomUUID(),
    b = crypto.randomUUID(),
    outsider = crypto.randomUUID();
  for (const [i, u] of [a, b, outsider].entries())
    await db.query("insert into auth.users values($1,$2)", [
      u,
      { username: `v02_${i}` },
    ]);
  const building = await scalar("select id from public.buildings");
  await db.query(
    "insert into private.invitations(building_id,code_hash,expires_at,uses_remaining) values($1,sha256(convert_to('fixture-invite','UTF8')),now()+interval '1 day',12)",
    [building],
  );
  await as(a, "select public.join_building('fixture-invite')");
  await as(b, "select public.join_building('fixture-invite')");
  await as(a, "select public.send_message('Eski mesaj korunur')");
  const oldPoll = await scalar("select id from public.polls");
  await as(a, "select public.cast_vote($1,true)", [oldPoll]);
  await as(b, "select public.cast_vote($1,true)", [oldPoll]);
  const fingerprint = () =>
    scalar(
      "select md5(string_agg(t||d,E'\\n' order by t,d)) from (select 'm' t,row_to_json(x)::text d from public.messages x union all select 'v',row_to_json(x)::text from public.votes x union all select 'i',row_to_json(x)::text from private.invitations x union all select 'a',row_to_json(x)::text from public.memberships x) q",
    );
  const before = await fingerprint();
  const v02 = await readFile("supabase/migrations/" + files[2], "utf8");
  await db.query(v02.replace(/select cron\.schedule\([^;]+;/g, ""));
  const today = await scalar(
    "select (clock_timestamp() at time zone 'Europe/Istanbul')::date::text",
  );
  await check(
    "Additive migration preserves legacy memberships/messages/votes/invitations/treasury",
    async () => {
      assert.equal(await fingerprint(), before);
      assert.equal(await cash(), 5000);
      assert.equal(await scalar("select count(*)::int from public.wallets"), 2);
      assert.equal(await balance(a), 300);
      assert.equal(await balance(b), 300);
    },
  );
  await check(
    "Initial 300 OP granted once to existing AND new residents",
    async () => {
      await db.query(
        "select private.wallet_post($1,300,'starting','once','retry')",
        [a],
      );
      assert.equal(await balance(a), 300);
      await as(outsider, "select public.join_building('fixture-invite')");
      assert.equal(await balance(outsider), 300);
      // Remove only this isolated fixture membership BEFORE election snapshot: preserves outsider auth for access tests.
      await db.query("delete from public.memberships where user_id=$1", [
        outsider,
      ]);
    },
  );
  await check(
    "Wallet/ledger privacy and direct balance/manager mutation denied",
    async () => {
      assert.equal((await as(a, "select * from public.wallets")).rowCount, 1);
      assert.equal(
        (await as(a, "select * from public.wallet_transactions")).rowCount,
        1,
      );
      await assert.rejects(() =>
        as(a, "update public.wallets set balance=99999"),
      );
      await assert.rejects(() =>
        as(
          a,
          "insert into public.manager_terms(building_id,election_id,user_id,starts_at,ends_at) values($1,$2,$3,now(),now()+interval '14 days')",
          [building, crypto.randomUUID(), a],
        ),
      );
      await assert.rejects(() => as(a, "select private.run_v02()"));
      await assert.rejects(() =>
        as(a, "select private.wallet_post($1,300,'starting','bad','bad')", [a]),
      );
    },
  );
  await check(
    "Job selection: equal 100 salary, first eligible day only",
    async () => {
      await action(a, "job", "office");
      await action(b, "job", "shop");
      await db.query("select private.run_v02()");
      assert.equal(await balance(a), 300);
      await assert.rejects(() => action(a, "job", "technical"));
      await db.query(
        "update public.wallets set employment_started_on=(clock_timestamp() at time zone 'Europe/Istanbul')::date-1 where user_id in ($1,$2)",
        [a, b],
      );
      await db.query("select private.run_v02()");
      assert.equal(await balance(a), 400);
      assert.equal(await balance(b), 400);
      await Promise.all([
        db.query("select private.run_v02()"),
        as(a, "select public.player_action('heartbeat')"),
      ]);
      assert.equal(await balance(a), 400);
    },
  );
  await check(
    "Inactive salary stopped; return pays CURRENT day only",
    async () => {
      await db.query(
        "delete from public.wallet_transactions where user_id=$1 and kind='salary'",
        [b],
      );
      await db.query(
        "update public.wallets set balance=300,last_active_at=clock_timestamp()-interval '8 days' where user_id=$1",
        [b],
      );
      await db.query("select private.run_v02()");
      assert.equal(await balance(b), 300);
      await action(b, "heartbeat");
      assert.equal(await balance(b), 400);
      assert.equal(
        await scalar(
          "select count(*)::int from public.wallet_transactions where user_id=$1 and kind='salary'",
          [b],
        ),
        1,
      );
    },
  );
  await check(
    "Side job timing, concurrent finish, once/day across job changes",
    async () => {
      await action(a, "side_start");
      await assert.rejects(() => action(a, "side_finish"));
      await db.query(
        "update public.wallets set side_job_started_at=clock_timestamp()-interval '4 seconds' where user_id=$1",
        [a],
      );
      const r = await Promise.allSettled([
        action(a, "side_finish"),
        action(a, "side_finish"),
      ]);
      assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(await balance(a), 425);
      await db.query(
        "update public.wallets set job_changed_at=clock_timestamp()-interval '8 days' where user_id=$1",
        [a],
      );
      await action(a, "job", "technical");
      assert.equal(await balance(a), 425);
      await assert.rejects(() => action(a, "side_start"));
    },
  );
  await check("No retroactive dues/expenses before first Monday", async () => {
    assert.equal(await scalar("select count(*)::int from public.dues"), 0);
    assert.equal(
      await scalar("select count(*)::int from public.operating_expenses"),
      0,
    );
  });
  await check(
    "Weekly issuance once, TR Monday and active-count expense formula",
    async () => {
      await db.query(
        "update public.economy_settings set first_week=date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')::date",
      );
      await db.query(
        "update public.memberships set joined_at=clock_timestamp()-interval '15 days'",
      );
      await db.query("select private.run_v02()");
      await db.query("select private.run_v02()");
      assert.equal(await scalar("select count(*)::int from public.dues"), 2);
      const expenses = (
        await db.query(
          "select kind,amount from public.operating_expenses order by kind",
        )
      ).rows;
      // Orphan wallet is no longer a resident and must NOT count as active in expenses.
      assert.deepEqual(expenses, [
        { kind: "cleaning", amount: 120 },
        { kind: "maintenance", amount: 70 },
      ]);
      assert.equal(await cash(), 4810);
    },
  );
  await check(
    "Atomic dues payment and concurrent duplicate prevention",
    async () => {
      const due = await scalar("select id from public.dues where user_id=$1", [
        a,
      ]);
      const oldBalance = await balance(a),
        oldCash = await cash();
      const r = await Promise.allSettled([
        as(a, "select public.pay_dues($1)", [due]),
        as(a, "select public.pay_dues($1)", [due]),
      ]);
      assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(await balance(a), oldBalance - 150);
      assert.equal(await cash(), oldCash + 150);
      assert.equal(
        await scalar(
          "select count(*)::int from public.treasury_entries where source_key=$1",
          ["dues:" + due],
        ),
        1,
      );
    },
  );
  await check(
    "Insufficient funds and another player dues both rejected atomically",
    async () => {
      const due = await scalar("select id from public.dues where user_id=$1", [
        b,
      ]);
      const oldCash = await cash();
      await db.query("update public.wallets set balance=10 where user_id=$1", [
        b,
      ]);
      await assert.rejects(() => as(b, "select public.pay_dues($1)", [due]));
      await assert.rejects(() => as(a, "select public.pay_dues($1)", [due]));
      assert.equal(await cash(), oldCash);
      assert.equal(await balance(b), 10);
      assert.equal(
        await scalar("select paid_at from public.dues where id=$1", [due]),
        null,
      );
    },
  );
  await check(
    "Inactive/new residents avoid new debt; unpaid expenses retried exactly once",
    async () => {
      await db.query(
        "delete from public.dues where user_id=$1 and paid_at is null",
        [b],
      );
      await db.query(
        "update public.wallets set last_active_at=clock_timestamp()-interval '8 days' where user_id=$1",
        [b],
      );
      await db.query("select private.run_v02()");
      assert.equal(
        await scalar("select count(*)::int from public.dues where user_id=$1", [
          b,
        ]),
        0,
      );
      const wk = await scalar(
        "select date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')::date::text",
      );
      await db.query(
        "insert into public.operating_expenses(building_id,week_start,kind,active_residents,amount) values($1,$2::date-7,'cleaning',2,20000)",
        [building, wk],
      );
      await db.query("select private.run_v02()");
      assert.equal(
        await scalar(
          "select count(*)::int from public.operating_expenses where paid_at is null",
        ),
        1,
      );
      await db.query("update public.buildings set treasury=25000");
      await db.query("select private.run_v02()");
      const paidCash = await cash();
      await db.query("select private.run_v02()");
      assert.equal(await cash(), paidCash);
      assert.equal(
        await scalar(
          "select count(*)::int from public.operating_expenses where paid_at is null",
        ),
        0,
      );
    },
  );
  let election = await scalar(
    "select id from public.elections where status='nominations'",
  );
  await check(
    "Two-player electorate quorum 2; candidate ownership/deadline; one candidacy",
    async () => {
      assert.equal(
        await scalar("select quorum from public.elections where id=$1", [
          election,
        ]),
        2,
      );
      await assert.rejects(() =>
        as(
          outsider,
          "select public.election_action($1,'candidate','Yabancı aday')",
          [election],
        ),
      );
      await as(
        a,
        "select public.election_action($1,'candidate','Düzenli bakım yapalım')",
        [election],
      );
      await assert.rejects(() =>
        as(a, "select public.election_action($1,'candidate','Tekrar adayım')", [
          election,
        ]),
      );
      await assert.rejects(() =>
        as(a, "select public.election_action($1,'vote',$2)", [election, a]),
      );
      await db.query(
        "update public.elections set starts_at=clock_timestamp()-interval '25 hours',nominations_end=clock_timestamp()-interval '1 hour',voting_end=clock_timestamp()+interval '47 hours' where id=$1",
        [election],
      );
      await assert.rejects(() =>
        as(b, "select public.election_action($1,'candidate','Geç aday')", [
          election,
        ]),
      );
    },
  );
  await check(
    "Valid candidate only, single vote, no forged voter id",
    async () => {
      await assert.rejects(() =>
        as(a, "select public.election_action($1,'vote',$2)", [
          election,
          outsider,
        ]),
      );
      await as(a, "select public.election_action($1,'vote',$2)", [election, a]);
      await assert.rejects(() =>
        as(a, "select public.election_action($1,'vote',$2)", [election, a]),
      );
      await as(b, "select public.election_action($1,'vote',$2)", [election, a]);
      await assert.rejects(() => as(a, "delete from public.election_votes"));
    },
  );
  await check(
    "Server winner, 14-day term; repeated resolution never duplicates",
    async () => {
      await db.query(
        "update public.elections set starts_at=clock_timestamp()-interval '73 hours',nominations_end=clock_timestamp()-interval '49 hours',voting_end=clock_timestamp()-interval '1 hour' where id=$1",
        [election],
      );
      await Promise.all([
        db.query("select private.run_v02()"),
        db.query("select private.run_v02()"),
      ]);
      assert.equal(
        await scalar("select winner_id from public.elections where id=$1", [
          election,
        ]),
        a,
      );
      assert.equal(
        await scalar("select count(*)::int from public.manager_terms"),
        1,
      );
      assert.equal(
        await scalar(
          "select extract(epoch from ends_at-starts_at)::int from public.manager_terms",
        ),
        14 * 86400,
      );
    },
  );
  await check(
    "Manager authorization, fixed catalog and one open proposal",
    async () => {
      await assert.rejects(() =>
        as(b, "select public.propose_management('door')"),
      );
      await assert.rejects(() =>
        as(a, "select public.propose_management('dues',999)"),
      );
      await assert.rejects(() =>
        as(a, "select public.propose_management('arbitrary')"),
      );
      await as(a, "select public.propose_management('door')");
      await assert.rejects(() =>
        as(a, "select public.propose_management('common_area')"),
      );
    },
  );
  await check(
    "Accepted expense proposal debited exactly once, old elevator quorum unchanged",
    async () => {
      const poll = await scalar(
        "select p.id from public.polls p join public.events e on e.id=p.event_id where e.kind like 'proposal_%'",
      );
      await as(a, "select public.cast_vote($1,true)", [poll]);
      await as(b, "select public.cast_vote($1,true)", [poll]);
      await db.query(
        "update public.polls set starts_at=now()-interval '25 hours',ends_at=now()-interval '1 hour' where id=$1",
        [poll],
      );
      const before = await cash();
      await as(a, "select public.settle_polls()");
      await as(a, "select public.settle_polls()");
      assert.equal(await cash(), before - 300);
      assert.equal(
        await scalar(
          "select count(*)::int from public.treasury_transactions where poll_id=$1",
          [poll],
        ),
        1,
      );
      assert.equal(
        await scalar("select minimum_votes from public.polls where id=$1", [
          oldPoll,
        ]),
        3,
      );
      assert.equal(
        await scalar("select count(*)::int from public.treasury_history"),
        await scalar(
          "select ((select count(*) from public.treasury_entries)+(select count(*) from public.treasury_transactions))::int",
        ),
      );
    },
  );
  await check(
    "Dues proposal changes NEXT period only, old debt untouched",
    async () => {
      const oldDues = (
        await db.query("select id,amount from public.dues order by id")
      ).rows;
      await as(a, "select public.propose_management('dues',180)");
      const p = await scalar(
        "select p.id from public.polls p join public.events e on e.id=p.event_id where e.proposal_type='dues'",
      );
      await as(a, "select public.cast_vote($1,true)", [p]);
      await as(b, "select public.cast_vote($1,true)", [p]);
      await db.query(
        "update public.polls set starts_at=now()-interval '25 hours',ends_at=now()-interval '1 hour' where id=$1",
        [p],
      );
      await as(a, "select public.settle_polls()");
      assert.equal(await scalar("select amount from public.dues_rates"), 180);
      assert.deepEqual(
        (await db.query("select id,amount from public.dues order by id")).rows,
        oldDues,
      );
      assert.equal(
        await scalar(
          "select effective_week=(date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')+interval '7 days')::date from public.dues_rates",
        ),
        true,
      );
    },
  );
  await check(
    "Proposal budget rechecked at resolution; no negative treasury",
    async () => {
      await as(a, "select public.propose_management('common_area')");
      const proposal = await scalar(
        "select p.id from public.polls p join public.events e on e.id=p.event_id where p.status='open' and e.kind like 'proposal_%'",
      );
      await as(a, "select public.cast_vote($1,true)", [proposal]);
      await as(b, "select public.cast_vote($1,true)", [proposal]);
      const cashBefore = await cash();
      await db.query("update public.buildings set treasury=10");
      await db.query(
        "update public.polls set starts_at=now()-interval '25 hours',ends_at=now()-interval '1 hour' where id=$1",
        [proposal],
      );
      await as(a, "select public.settle_polls()");
      assert.equal(
        await scalar("select status from public.polls where id=$1", [proposal]),
        "rejected",
      );
      assert.equal(await cash(), 10);
      await db.query("update public.buildings set treasury=$1", [cashBefore]);
    },
  );
  await check(
    "Expired manager loses authority, routine economy and next election continue",
    async () => {
      await db.query(
        "update public.manager_terms set starts_at=now()-interval '15 days',ends_at=now()-interval '1 day'",
      );
      await assert.rejects(() =>
        as(a, "select public.propose_management('door')"),
      );
      await db.query("select private.run_v02()");
      election = await scalar(
        "select id from public.elections where status='nominations'",
      );
      assert.ok(election);
    },
  );
  await check(
    "No candidates, low turnout and ties fail fairly, then retry after 24h",
    async () => {
      for (const scenario of ["none", "low", "tie"]) {
        if (scenario !== "none") {
          await as(
            a,
            "select public.election_action($1,'candidate','Aday A')",
            [election],
          );
          if (scenario === "tie")
            await as(
              b,
              "select public.election_action($1,'candidate','Aday B')",
              [election],
            );
        }
        await db.query(
          "update public.elections set starts_at=clock_timestamp()-interval '25 hours',nominations_end=clock_timestamp()-interval '1 hour',voting_end=clock_timestamp()+interval '1 hour' where id=$1",
          [election],
        );
        if (scenario !== "none")
          await as(a, "select public.election_action($1,'vote',$2)", [
            election,
            a,
          ]);
        if (scenario === "tie")
          await as(b, "select public.election_action($1,'vote',$2)", [
            election,
            b,
          ]);
        await db.query(
          "update public.elections set starts_at=clock_timestamp()-interval '73 hours',nominations_end=clock_timestamp()-interval '49 hours',voting_end=clock_timestamp()-interval '1 hour' where id=$1",
          [election],
        );
        await db.query("select private.run_v02()");
        assert.equal(
          await scalar("select status from public.elections where id=$1", [
            election,
          ]),
          "failed",
        );
        assert.equal(
          await scalar("select count(*)::int from public.manager_terms"),
          1,
        );
        await db.query(
          "update public.elections set retry_after=clock_timestamp()-interval '1 second' where id=$1",
          [election],
        );
        await db.query("select private.run_v02()");
        election = await scalar(
          "select id from public.elections where status='nominations'",
        );
        assert.ok(election);
      }
    },
  );
  await check(
    "All new tables RLS; own economy inaccessible to outsider; old chat survives",
    async () => {
      assert.equal(
        await scalar(
          "select count(*)::int from pg_tables where schemaname in ('public','private') and not rowsecurity",
        ),
        0,
      );
      assert.equal(
        (await as(outsider, "select * from public.wallets")).rowCount,
        0,
      );
      assert.equal(
        (await as(outsider, "select * from public.treasury_history")).rowCount,
        0,
      );
      await as(b, "select public.send_message('v02 sohbet devam ediyor')");
      assert.equal((await as(a, "select * from public.messages")).rowCount, 2);
    },
  );
  await check(
    "Building dues totals expose no individual debt rows",
    async () => {
      const overview = await as(a, "select * from public.dues_overview()");
      assert.ok(overview.rowCount);
      assert.ok(!("user_id" in overview.rows[0]));
      assert.equal(
        (await as(outsider, "select * from public.dues_overview()")).rowCount,
        0,
      );
    },
  );
  await check(
    "Post-upgrade elevator still accepts three valid votes and charges once",
    async () => {
      await as(outsider, "select public.join_building('fixture-invite')");
      await as(outsider, "select public.cast_vote($1,true)", [oldPoll]);
      await db.query(
        "update public.polls set starts_at=now()-interval '25 hours',ends_at=now()-interval '1 hour' where id=$1",
        [oldPoll],
      );
      const oldCash = await cash();
      await as(a, "select public.settle_polls()");
      await as(a, "select public.settle_polls()");
      assert.equal(await cash(), oldCash - 1200);
      assert.equal(
        await scalar(
          "select count(*)::int from public.treasury_transactions where poll_id=$1",
          [oldPoll],
        ),
        1,
      );
    },
  );
  await check(
    "Single-resident apartment cannot start an election",
    async () => {
      await db.query(
        "update public.elections set status='failed',retry_after=null where status in ('nominations','voting')",
      );
      await db.query("delete from public.memberships where user_id<>$1", [a]);
      await db.query("select private.run_v02()");
      assert.equal(
        await scalar(
          "select count(*)::int from public.elections where status in ('nominations','voting')",
        ),
        0,
      );
    },
  );
  console.log(
    `\n${count} v0.2 integration groups passed. Hosted Auth/Realtime UI not exercised.`,
  );
} finally {
  await db.end();
  await admin.query("drop database apartman_v02 with (force)");
  await admin.end();
}
