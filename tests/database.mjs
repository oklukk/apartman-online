// Integration suite. ONLY a disposable local Supabase, never a hosted project.
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
const config = JSON.parse(
  await readFile(new URL("../work/local-status.json", import.meta.url), "utf8"),
);
assert.match(config.API_URL, /^http:\/\/(127\.0\.0\.1|localhost):54321$/);
assert.match(config.DB_URL, /@(127\.0\.0\.1|localhost):54322\//);
const db = new pg.Client({ connectionString: config.DB_URL });
await db.connect();
const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, ok: false });
    throw e;
  }
}
const make = () =>
  createClient(config.API_URL, config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const users = [];
try {
  assert.equal(
    Number(
      (await db.query("select count(*) from public.memberships")).rows[0].count,
    ),
    0,
    "Use a fresh disposable stack",
  );
  const b = (
    await db.query("select id from public.buildings where slug='cinar'")
  ).rows[0].id;
  const code = crypto.randomUUID() + crypto.randomUUID();
  await db.query(
    "insert into private.invitations(building_id,code_hash,expires_at,uses_remaining) values($1,sha256(convert_to($2,'UTF8')),now()+interval '1 hour',20)",
    [b, code],
  );
  await check("E-posta ile kayıt, benzersiz kullanıcı adları", async () => {
    for (let i = 0; i < 14; i++) {
      const c = make();
      const email = `local${i}-${Date.now()}@example.com`,
        password = crypto.randomUUID();
      const r = await c.auth.signUp({
        email,
        password,
        options: { data: { username: `komsu_${i}` } },
      });
      assert.ifError(r.error);
      assert.ok(r.data.session);
      users.push({ c, email, password, id: r.data.user.id });
    }
    const dup = await make().auth.signUp({
      email: `dupe-${Date.now()}@example.com`,
      password: crypto.randomUUID(),
      options: { data: { username: "KOMSU_0" } },
    });
    assert.ok(dup.error);
  });
  await check("Giriş, çıkış, oturum yenileme ve geri yükleme", async () => {
    const u = users[0],
      saved = (await u.c.auth.getSession()).data.session;
    const other = make();
    assert.ifError(
      (
        await other.auth.setSession({
          access_token: saved.access_token,
          refresh_token: saved.refresh_token,
        })
      ).error,
    );
    assert.equal((await other.auth.getUser()).data.user.id, u.id);
    assert.ifError((await other.auth.refreshSession()).error);
    assert.ifError((await u.c.auth.signOut()).error);
    assert.equal((await u.c.auth.getSession()).data.session, null);
    assert.ifError(
      (
        await u.c.auth.signInWithPassword({
          email: u.email,
          password: u.password,
        })
      ).error,
    );
  });
  await check("Geçersiz davetiye reddi", async () =>
    assert.ok(
      (await users[0].c.rpc("join_building", { invite_code: "invalid" })).error,
    ),
  );
  await check(
    "13 eşzamanlı taşınma: tam 12 daire, tekil kullanıcı/daire, kapasite kontrolü",
    async () => {
      const attempts = await Promise.all(
        users
          .slice(0, 13)
          .map((u) => u.c.rpc("join_building", { invite_code: code })),
      );
      assert.equal(attempts.filter((r) => !r.error).length, 12);
      const rows = (await db.query("select * from public.memberships")).rows;
      assert.equal(rows.length, 12);
      assert.equal(new Set(rows.map((r) => r.apartment_id)).size, 12);
      assert.equal(new Set(rows.map((r) => r.user_id)).size, 12);
      assert.equal(
        Number(
          (await db.query("select uses_remaining from private.invitations"))
            .rows[0].uses_remaining,
        ),
        8,
      );
    },
  );
  const ids = new Set(
    (await db.query("select user_id from public.memberships")).rows.map(
      (r) => r.user_id,
    ),
  );
  const residents = users.filter((u) => ids.has(u.id)),
    outsider = users.find((u) => !ids.has(u.id));
  const [a, z] = residents;
  await check("Aynı hesabın ikinci daireyi sahiplenmesi engelli", async () =>
    assert.ok((await a.c.rpc("join_building", { invite_code: code })).error),
  );
  await check(
    "Yetkisiz mesaj okuma ve doğrudan kasa/üyelik/mesaj değişimi engelli",
    async () => {
      for (const c of [make(), outsider.c]) {
        const r = await c.from("messages").select("*");
        assert.ok(r.error || r.data.length === 0);
      }
      assert.ok(
        (await a.c.from("buildings").update({ treasury: 999999 }).eq("id", b))
          .error,
      );
      assert.ok(
        (
          await outsider.c
            .from("memberships")
            .insert({
              user_id: outsider.id,
              building_id: b,
              apartment_id: crypto.randomUUID(),
            })
        ).error,
      );
      assert.ok(
        (
          await a.c
            .from("messages")
            .insert({ building_id: b, author_id: z.id, body: "fake" })
        ).error,
      );
      assert.ok((await a.c.schema("private").rpc("resolve_due_polls")).error);
    },
  );
  await check(
    "İki ayrı gerçek oturumda çift yönlü Realtime sohbet",
    async () => {
      async function receive(receiver, sender, body) {
        let resolveReceived;
        const received = new Promise((r) => (resolveReceived = r));
        const channel = receiver.c
          .channel(crypto.randomUUID())
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `building_id=eq.${b}`,
            },
            (p) => {
              if (p.new.body === body) resolveReceived(p.new);
            },
          );
        await new Promise((res, rej) => {
          const timeout = setTimeout(
            () => rej(Error("subscribe timeout")),
            15000,
          );
          channel.subscribe((s) => {
            if (s === "SUBSCRIBED") {
              clearTimeout(timeout);
              res();
            } else if (s === "CHANNEL_ERROR") {
              clearTimeout(timeout);
              rej(Error(s));
            }
          });
        });
        try {
          assert.ifError(
            (await sender.c.rpc("send_message", { message_body: body })).error,
          );
          let timer;
          const payload = await Promise.race([
            received,
            new Promise((_, rej) => {
              timer = setTimeout(
                () => rej(Error("Realtime message timeout")),
                15000,
              );
            }),
          ]).finally(() => clearTimeout(timer));
          assert.equal(payload.author_id, sender.id);
        } finally {
          await receiver.c.removeChannel(channel);
        }
      }
      await receive(z, a, "Merhaba komşum A");
      await receive(a, z, "Merhaba komşum B");
    },
  );
  await check(
    "Sohbet geçmişi kalıcı; yetkisiz kişi okuyamaz; spam/uzunluk engelli",
    async () => {
      assert.equal((await a.c.from("messages").select("*")).data.length, 2);
      assert.equal(
        (await outsider.c.from("messages").select("*")).data.length,
        0,
      );
      await db.query(
        "update public.memberships set last_message_at=clock_timestamp() where user_id=$1",
        [a.id],
      );
      assert.ok(
        (await a.c.rpc("send_message", { message_body: "spam" })).error,
      );
      assert.ok(
        (await a.c.rpc("send_message", { message_body: "x".repeat(501) }))
          .error,
      );
      assert.ok(
        (await outsider.c.rpc("send_message", { message_body: "no access" }))
          .error,
      );
    },
  );
  await check("İşlevsel engelleme, engel kaldırma ve şikâyet RLS", async () => {
    const message = (
      await a.c.from("messages").select("*").eq("author_id", z.id)
    ).data[0];
    assert.ifError(
      (
        await a.c
          .from("message_reports")
          .insert({
            reporter_id: a.id,
            message_id: message.id,
            reason: "Test şikâyeti",
          })
      ).error,
    );
    assert.equal(
      (await z.c.from("message_reports").select("*")).data.length,
      0,
    );
    assert.ok(
      (
        await a.c
          .from("message_reports")
          .insert({
            reporter_id: z.id,
            message_id: message.id,
            reason: "Sahte kimlik",
          })
      ).error,
    );
    assert.ifError(
      (await a.c.from("blocks").insert({ user_id: a.id, blocked_id: z.id }))
        .error,
    );
    assert.equal(
      (await a.c.from("messages").select("*").eq("author_id", z.id)).data
        .length,
      0,
    );
    assert.ifError(
      (await a.c.from("blocks").delete().eq("blocked_id", z.id)).error,
    );
    assert.equal(
      (await a.c.from("messages").select("*").eq("author_id", z.id)).data
        .length,
      1,
    );
  });
  const poll = (await db.query("select * from public.polls")).rows[0];
  await check(
    "24 saat süre ve sunucu oy yetkisi; ikinci oy ve sahte doğrudan yazım reddi",
    async () => {
      assert.equal(new Date(poll.ends_at) - new Date(poll.starts_at), 86400000);
      assert.ok(
        (
          await outsider.c.rpc("cast_vote", {
            target_poll: poll.id,
            approve: true,
          })
        ).error,
      );
      assert.ifError(
        (await a.c.rpc("cast_vote", { target_poll: poll.id, approve: true }))
          .error,
      );
      assert.ok(
        (await a.c.rpc("cast_vote", { target_poll: poll.id, approve: false }))
          .error,
      );
      assert.ok(
        (
          await a.c
            .from("votes")
            .insert({ poll_id: poll.id, user_id: z.id, choice: true })
        ).error,
      );
      assert.ifError(
        (await z.c.rpc("cast_vote", { target_poll: poll.id, approve: true }))
          .error,
      );
      assert.ifError(
        (
          await residents[2].c.rpc("cast_vote", {
            target_poll: poll.id,
            approve: false,
          })
        ).error,
      );
      assert.ifError((await a.c.rpc("settle_polls")).error);
      assert.equal(
        (await db.query("select treasury from public.buildings")).rows[0]
          .treasury,
        5000,
      );
    },
  );
  await check(
    "Süre sonu, çoğunluk, 1.200 OP düşümü ve tekrarda mükerrer düşüm olmaması",
    async () => {
      await db.query(
        "update public.polls set starts_at=now()-interval '25 hours',ends_at=now()-interval '1 hour' where id=$1",
        [poll.id],
      );
      assert.ok(
        (
          await residents[3].c.rpc("cast_vote", {
            target_poll: poll.id,
            approve: true,
          })
        ).error,
      );
      await Promise.all(
        residents
          .slice(0, 6)
          .map((u) =>
            u.c.rpc("settle_polls").then((r) => assert.ifError(r.error)),
          ),
      );
      assert.equal(
        (await db.query("select treasury from public.buildings")).rows[0]
          .treasury,
        3800,
      );
      assert.equal(
        Number(
          (await db.query("select count(*) from public.treasury_transactions"))
            .rows[0].count,
        ),
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
  await check(
    "Eşitlik, yetersiz katılım, yetersiz bütçe ret; offline worker; değişmez kasa",
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
            [p, residents[i].id, choices[i]],
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
      assert.ok(
        (
          await db.query(
            "select * from cron.job where jobname='apartman-resolve-polls' and active",
          )
        ).rows.length,
      );
    },
  );
  await check(
    "Gerçek işlem kaynaklı kalıcı gelişmeler ve tüm tablolarda RLS",
    async () => {
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
      const unprotected = await db.query(
        "select tablename from pg_tables where schemaname in ('public','private') and not rowsecurity",
      );
      assert.equal(unprotected.rowCount, 0);
      const funcs = await db.query(
        "select proname from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='private' and proname in ('resolve_poll','resolve_due_polls','create_profile') and has_function_privilege('authenticated',p.oid,'execute')",
      );
      assert.equal(funcs.rowCount, 0);
    },
  );
  console.log(`\n${results.length} integration checks passed.`);
} finally {
  for (const u of users) await u.c.removeAllChannels();
  await db.end();
}
