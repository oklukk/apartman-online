import pg from "pg";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const connectionString =
  "postgresql://postgres:local-test-only@127.0.0.1:55432/postgres";
const db = new pg.Client({ connectionString });
await db.connect();
let count = 0;
const run = async (name, fn) => {
  await fn();
  console.log("PASS", name);
  count++;
};
const as = async (uid, sql, args = []) => {
  const c = new pg.Client({ connectionString });
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    const r = await c.query(sql, args);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    await c.end();
  }
};
try {
  // Fail closed if this disposable DB was already initialized.
  assert.equal(
    (await db.query("select 1 from pg_namespace where nspname='auth'"))
      .rowCount,
    0,
    "Create a fresh test container",
  );
  await db.query(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create publication supabase_realtime;`);
  const files = (await readdir("supabase/migrations")).sort();
  await db.query(await readFile(`supabase/migrations/${files[0]}`, "utf8"));
  // Exact scheduled worker body, without pg_cron which plain PostgreSQL does not ship.
  const cronSql = await readFile(`supabase/migrations/${files[1]}`, "utf8");
  await db.query(
    cronSql.slice(
      cronSql.indexOf("create function"),
      cronSql.indexOf("select cron.schedule"),
    ),
  );
  const users = Array.from({ length: 14 }, () => crypto.randomUUID());
  await run(
    "Auth trigger creates unique case-insensitive usernames",
    async () => {
      for (let i = 0; i < users.length; i++)
        await db.query("insert into auth.users values($1,$2)", [
          users[i],
          { username: `komsu_${i}` },
        ]);
      await assert.rejects(() =>
        db.query("insert into auth.users values($1,$2)", [
          crypto.randomUUID(),
          { username: "KOMSU_0" },
        ]),
      );
      await assert.rejects(() =>
        db.query("insert into auth.users values($1,$2)", [
          crypto.randomUUID(),
          { username: "<script>" },
        ]),
      );
    },
  );
  const b = (await db.query("select id from public.buildings")).rows[0].id;
  const code = crypto.randomUUID() + crypto.randomUUID();
  await db.query(
    "insert into private.invitations(building_id,code_hash,expires_at,uses_remaining) values($1,sha256(convert_to($2,'UTF8')),now()+interval '1 hour',20)",
    [b, code],
  );
  await run("Invalid / expired / anonymous invitation denied", async () => {
    await assert.rejects(() =>
      as(users[0], "select public.join_building($1)", ["bad"]),
    );
    await db.query(
      "insert into private.invitations(building_id,code_hash,expires_at,uses_remaining) values($1,sha256(convert_to('expired','UTF8')),now()-interval '1 hour',1)",
      [b],
    );
    await assert.rejects(() =>
      as(users[0], "select public.join_building('expired')"),
    );
    await assert.rejects(() =>
      as("", "select public.join_building($1)", [code]),
    );
  });
  await run(
    "13 concurrent joins: 12 unique apartments; atomic invitation use",
    async () => {
      const r = await Promise.allSettled(
        users
          .slice(0, 13)
          .map((u) => as(u, "select public.join_building($1)", [code])),
      );
      assert.equal(r.filter((v) => v.status === "fulfilled").length, 12);
      const m = (await db.query("select * from public.memberships")).rows;
      assert.equal(m.length, 12);
      assert.equal(new Set(m.map((v) => v.apartment_id)).size, 12);
      const nums = (
        await db.query(
          "select number from public.apartments a join public.memberships m on m.apartment_id=a.id order by number",
        )
      ).rows.map((v) => v.number);
      assert.deepEqual(
        nums,
        Array.from({ length: 12 }, (_, i) => i + 1),
      );
      assert.equal(
        (
          await db.query(
            "select uses_remaining from private.invitations where code_hash=sha256(convert_to($1,'UTF8'))",
            [code],
          )
        ).rows[0].uses_remaining,
        8,
      );
    },
  );
  const members = (
    await db.query("select user_id from public.memberships")
  ).rows.map((v) => v.user_id);
  const [a, z] = members;
  const outsider = users.find((u) => !members.includes(u));
  await run(
    "One apartment per account; no forged direct membership/treasury writes",
    async () => {
      await assert.rejects(() =>
        as(a, "select public.join_building($1)", [code]),
      );
      await assert.rejects(() =>
        as(a, "update public.buildings set treasury=99999"),
      );
      await assert.rejects(() =>
        as(
          outsider,
          "insert into public.memberships(user_id,building_id,apartment_id) values($1,$2,$3)",
          [outsider, b, crypto.randomUUID()],
        ),
      );
    },
  );
  await run(
    "Messages derive sender identity, enforce length and serialize spam",
    async () => {
      assert.equal(
        (await as(a, "select public.send_message($1)", ["Merhaba"])).rowCount,
        1,
      );
      assert.equal(
        (await db.query("select author_id from public.messages")).rows[0]
          .author_id,
        a,
      );
      await assert.rejects(() =>
        as(a, "select public.send_message($1)", ["spam"]),
      );
      await assert.rejects(() =>
        as(z, "select public.send_message($1)", ["x".repeat(501)]),
      );
      await assert.rejects(() =>
        as(z, "select public.send_message($1)", [" "]),
      );
      await assert.rejects(() =>
        as(outsider, "select public.send_message($1)", ["no"]),
      );
      await assert.rejects(() =>
        as(
          z,
          "insert into public.messages(building_id,author_id,body) values($1,$2,$3)",
          [b, a, "forged"],
        ),
      );
      await as(z, "select public.send_message($1)", ["Merhaba komşu"]);
    },
  );
  await run(
    "RLS: outsiders cannot read history, profiles or building; residents can",
    async () => {
      assert.equal(
        (await as(outsider, "select * from public.messages")).rowCount,
        0,
      );
      assert.equal(
        (await as(outsider, "select * from public.buildings")).rowCount,
        0,
      );
      assert.equal(
        (await as(outsider, "select * from public.profiles")).rowCount,
        1,
      );
      assert.equal((await as(a, "select * from public.messages")).rowCount, 2);
      assert.equal((await as(a, "select * from public.profiles")).rowCount, 12);
    },
  );
  await run(
    "Blocking and reporting enforce ownership and visibility",
    async () => {
      const msg = (
        await db.query("select id from public.messages where author_id=$1", [z])
      ).rows[0].id;
      await as(
        a,
        "insert into public.message_reports(reporter_id,message_id,reason) values($1,$2,$3)",
        [a, msg, "Test şikâyeti"],
      );
      assert.equal(
        (await as(z, "select * from public.message_reports")).rowCount,
        0,
      );
      await assert.rejects(() =>
        as(
          a,
          "insert into public.message_reports(reporter_id,message_id,reason) values($1,$2,$3)",
          [z, msg, "Sahte kimlik"],
        ),
      );
      await as(a, "insert into public.blocks values($1,$2)", [a, z]);
      assert.equal(
        (await as(a, "select * from public.messages where author_id=$1", [z]))
          .rowCount,
        0,
      );
      await as(a, "delete from public.blocks where blocked_id=$1", [z]);
      assert.equal(
        (await as(a, "select * from public.messages where author_id=$1", [z]))
          .rowCount,
        1,
      );
    },
  );
  const poll = (await db.query("select * from public.polls")).rows[0];
  await run(
    "24-hour window; duplicate/unauthorized/future votes rejected",
    async () => {
      assert.equal(new Date(poll.ends_at) - new Date(poll.starts_at), 86400000);
      await assert.rejects(() =>
        as(outsider, "select public.cast_vote($1,true)", [poll.id]),
      );
      await as(a, "select public.cast_vote($1,true)", [poll.id]);
      await assert.rejects(() =>
        as(a, "select public.cast_vote($1,false)", [poll.id]),
      );
      await assert.rejects(() =>
        as(z, "insert into public.votes values($1,$2,true,now())", [
          poll.id,
          z,
        ]),
      );
      await db.query(
        "update public.polls set starts_at=now()+interval '1 hour',ends_at=now()+interval '25 hours' where id=$1",
        [poll.id],
      );
      await assert.rejects(() =>
        as(z, "select public.cast_vote($1,true)", [poll.id]),
      );
      await db.query(
        "update public.polls set starts_at=$2,ends_at=$3 where id=$1",
        [poll.id, poll.starts_at, poll.ends_at],
      );
      await as(z, "select public.cast_vote($1,true)", [poll.id]);
      await as(members[2], "select public.cast_vote($1,false)", [poll.id]);
      await as(a, "select public.settle_polls()");
      assert.equal(
        (await db.query("select treasury from public.buildings")).rows[0]
          .treasury,
        5000,
      );
    },
  );
  await run(
    "Deadline enforced; 6 concurrent settlers charge treasury only once",
    async () => {
      await db.query(
        "update public.polls set starts_at=now()-interval '25 hours',ends_at=now()-interval '1 hour' where id=$1",
        [poll.id],
      );
      await assert.rejects(() =>
        as(members[3], "select public.cast_vote($1,true)", [poll.id]),
      );
      await Promise.all(
        members.slice(0, 6).map((u) => as(u, "select public.settle_polls()")),
      );
      assert.equal(
        (await db.query("select treasury from public.buildings")).rows[0]
          .treasury,
        3800,
      );
      assert.equal(
        (await db.query("select * from public.treasury_transactions")).rowCount,
        1,
      );
      assert.equal(
        (
          await db.query("select status from public.polls where id=$1", [
            poll.id,
          ])
        ).rows[0].status,
        "accepted",
      );
    },
  );
  await run(
    "Tie, insufficient quorum and insufficient treasury rejected by worker",
    async () => {
      for (const [kind, choices, cost] of [
        ["tie", [true, true, false, false], 1200],
        ["quorum", [true, true], 1200],
        ["funds", [true, true, true], 99999],
      ]) {
        const ev = (
          await db.query(
            "insert into public.events(building_id,kind,title,description,cost) values($1,$2,$2,$2,$3) returning id",
            [b, kind, cost],
          )
        ).rows[0].id;
        const p = (
          await db.query(
            "insert into public.polls(building_id,event_id,starts_at,ends_at) values($1,$2,now()-interval '25 hours',now()-interval '1 hour') returning id",
            [b, ev],
          )
        ).rows[0].id;
        for (let i = 0; i < choices.length; i++)
          await db.query(
            "insert into public.votes(poll_id,user_id,choice) values($1,$2,$3)",
            [p, members[i], choices[i]],
          );
        await db.query("select private.resolve_due_polls()");
        assert.equal(
          (await db.query("select status from public.polls where id=$1", [p]))
            .rows[0].status,
          "rejected",
        );
      }
      assert.equal(
        (await db.query("select treasury from public.buildings")).rows[0]
          .treasury,
        3800,
      );
    },
  );
  await run(
    "Internal privileged functions not callable by player; all tables RLS",
    async () => {
      await assert.rejects(() => as(a, "select private.resolve_due_polls()"));
      await assert.rejects(() =>
        as(a, "select private.resolve_poll($1)", [poll.id]),
      );
      assert.equal(
        (
          await db.query(
            "select tablename from pg_tables where schemaname in ('public','private') and not rowsecurity",
          )
        ).rowCount,
        0,
      );
      for (const kind of [
        "move_in",
        "poll_started",
        "poll_resolved",
        "expense",
      ])
        assert.ok(
          (
            await db.query("select 1 from public.activity where kind=$1", [
              kind,
            ])
          ).rowCount,
        );
    },
  );
  console.log(
    `\n${count} PostgreSQL integration checks passed. Auth HTTP / Realtime / cron scheduler NOT tested here.`,
  );
} finally {
  await db.end();
}
