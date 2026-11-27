// ONLY this hard-coded disposable local PostgreSQL. No environment URL or hosted fallback.
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const base = 'postgresql://postgres:local-test-only@127.0.0.1:55432/postgres';
const admin = new pg.Client({ connectionString: base });
const url = new URL(base); url.pathname = '/apartman_a1';
const db = new pg.Client({ connectionString: url.href });
const tables = ['actors','npc_population_plans','npc_buildings','npc_homes','bot_profiles','actor_skills'];
const skills = ['plumbing','business','basic_teaching','advanced_teaching'];
const uuid = () => crypto.randomUUID();
let count = 0;
const scalar = async (sql, args = [], c = db) => Object.values((await c.query(sql, args)).rows[0])[0];
const check = async (name, fn) => { await fn(); count++; console.log('PASS', name); };
async function transaction(fn, isolation = 'read committed') {
  const c = new pg.Client({ connectionString: url.href }); await c.connect();
  try {
    assert.ok(['read committed','repeatable read'].includes(isolation));
    await c.query('begin isolation level ' + isolation);
    await c.query("set local statement_timeout='10s'");
    const value = await fn(c); await c.query('commit'); return value;
  } catch (e) { await c.query('rollback'); throw e; }
  finally { await c.end(); }
}
async function as(uid, sql, args = [], role = 'authenticated') {
  assert.ok(['authenticated','anon','service_role'].includes(role));
  return transaction(async c => {
    await c.query('set local role ' + role);
    await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [uid, JSON.stringify({ sub: uid, aal: 'aal2', user_metadata: { role: 'super_admin' } })]);
    return c.query(sql,args);
  });
}
const denies = (fn, codes = ['23514']) => assert.rejects(fn, e => {
  assert.ok(codes.includes(e.code), `Expected ${codes}, got ${e.code}: ${e.message}`); return true;
});
async function player(c, profile, actor = uuid(), values = Object.fromEntries(skills.map(s => [s,[0,0]]))) {
  await c.query("insert into private.actors(id,kind,profile_id) values($1,'player',$2)",[actor,profile]);
  for (const [s,[level,xp]] of Object.entries(values))
    await c.query('insert into private.actor_skills values($1,$2,$3,$4)',[actor,s,level,xp]);
  return actor;
}
async function housing({ scope = 'world', limit = 20, capacity = 12 } = {}) {
  const plan = uuid(), building = uuid(), homes = Array.from({ length: capacity },uuid);
  await transaction(async c => {
    await c.query('insert into private.npc_population_plans(id,code,scope,population_limit) values($1,$2,$3,$4)',
      [plan,'test_' + plan.replaceAll('-',''),scope,limit]);
    await c.query("insert into private.npc_buildings values($1,$2,'Fixture NPC binası',$3)",[building,plan,capacity]);
    for (const [i,id] of homes.entries()) await c.query('insert into private.npc_homes values($1,$2,$3,$4)',[id,plan,building,i+1]);
  });
  return { plan, building, homes };
}
async function bot(c, h, { actor = uuid(), home = h.homes[0], role = 'lecturer', field = 'plumbing',
  fields = role === 'lecturer' ? [field] : [],
  levels = role === 'lecturer' ? { [field]:6, basic_teaching:5, advanced_teaching:3 } :
    role === 'worker' ? { [field]:3 } : { [field]:4, business:4 }, xp = 0 } = {}) {
  await c.query("insert into private.actors(id,kind) values($1,'bot')",[actor]);
  await c.query('insert into private.bot_profiles(actor_id,plan_id,home_id,display_name,role,field,teaching_fields) values($1,$2,$3,$4,$5,$6,$7)',
    [actor,h.plan,home,'Fixture NPC',role,field,fields]);
  for (const [s,level] of Object.entries(levels))
    await c.query('insert into private.actor_skills values($1,$2,$3,$4)',[actor,s,level,xp]);
  return actor;
}

await admin.connect();
// CREATE DATABASE (no IF EXISTS/drop-before-create) fails closed on accidental reuse.
await admin.query('create database apartman_a1');
await db.connect();
try {
  for (const role of ['anon','authenticated','service_role']) {
    if (!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)
      await admin.query('create role ' + role + ' nologin');
  }
  await db.query(`create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
    create table auth.mfa_factors(user_id uuid references auth.users,status text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid(),auth.jwt() to authenticated,anon;
    create publication supabase_realtime;
    -- Scheduler registration stub only; this is NOT a real pg_cron worker test.
    create schema cron; create table cron.job(jobid bigint generated always as identity,jobname text unique,schedule text,command text);
    create function cron.schedule(n text,s text,c text) returns bigint language sql as $$
      insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid $$;`);
  const files = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
  assert.equal(files.length,8);
  assert.match(files[7], /_a1_actor_persistence\.sql$/);
  for (const file of files.slice(0,7)) {
    const sql = (await readFile('supabase/migrations/' + file,'utf8'))
      .replace(/create extension if not exists pg_cron with schema pg_catalog;/g,'');
    await db.query('begin'); await db.query(sql); await db.query('commit');
  }
  const [a,b,staff] = [uuid(),uuid(),uuid()];
  for (const [i,id] of [a,b,staff].entries()) await db.query('insert into auth.users values($1,$2,now())',[id,{ username:'a1_fixture_' + i }]);
  const building = await scalar("select id from public.buildings where slug='cinar'");
  await db.query("insert into private.invitations(building_id,code_hash,expires_at,uses_remaining) values($1,sha256(convert_to('a1-fixture','UTF8')),now()+interval '1 day',12)",[building]);
  await as(a,"select public.join_building('a1-fixture')"); await as(b,"select public.join_building('a1-fixture')");
  await as(a,"select public.send_message('A1 öncesi korunan mesaj')");
  await as(a,"select public.player_action('job','technical')");
  const poll = await scalar('select id from public.polls limit 1');
  await as(a,'select public.cast_vote($1,true)',[poll]);
  await db.query("insert into public.dues(building_id,user_id,week_start,amount) values($1,$2,date_trunc('week',now() at time zone 'Europe/Istanbul')::date,150)",[building,a]);
  await db.query('select private.run_v02()');
  const election = await scalar('select id from public.elections limit 1');
  await db.query("insert into public.election_candidates(election_id,user_id,building_id,statement) values($1,$2,$3,'Fixture vaadi')",[election,a,building]);
  await db.query('insert into public.election_votes(election_id,user_id,candidate_id,building_id) values($1,$2,$2,$3)',[election,a,building]);
  await db.query("insert into public.manager_terms(building_id,user_id,starts_at,ends_at) values($1,$2,now()-interval '1 day',now()+interval '13 days')",[building,a]);
  await db.query("insert into auth.mfa_factors values($1,'verified')",[staff]);
  await db.query("select private.staff_bootstrap($1,'Disposable A1 fixture sahibi')",[staff]);

  const legacyTables = (await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','cron') order by 1,2")).rows;
  const quote = s => '"' + s.replaceAll('"','""') + '"';
  async function rowsSnapshot() {
    const snapshot = {};
    for (const {schemaname:s,tablename:t} of legacyTables) snapshot[s + '.' + t] =
      (await db.query(`select count(*)::int n,md5(coalesce(string_agg(row_to_json(r)::text,E'\n' order by row_to_json(r)::text),'')) hash from ${quote(s)}.${quote(t)} r`)).rows[0];
    return snapshot;
  }
  async function schemaSnapshot() {
    return (await db.query(`select 'function' kind,n.nspname||'.'||p.oid::regprocedure::text key,
      jsonb_build_object('src',p.prosrc,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig) value
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth','cron')
      union all select 'policy',schemaname||'.'||tablename||'.'||policyname,to_jsonb(p) from pg_policies p
      union all select 'trigger',tgrelid::regclass::text||'.'||tgname,to_jsonb(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal
      union all select 'publication',pubname,to_jsonb(p) from pg_publication p
      union all select 'publication_table',pubname||'.'||schemaname||'.'||tablename,to_jsonb(p) from pg_publication_tables p
      union all select 'table',n.nspname||'.'||c.relname,jsonb_build_object('acl',c.relacl,'rls',c.relrowsecurity)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','cron') and c.relkind in ('r','v')
      order by 1,2`)).rows;
  }
  const beforeRows = await rowsSnapshot(), beforeSchema = await schemaSnapshot();
  const migration = await readFile('supabase/migrations/' + files[7],'utf8');
  await db.query('begin'); await db.query(migration); await db.query('commit');
  await check('empty additive migration preserves EVERY legacy table row/count/hash, RPC, RLS, grant, trigger, publication and cron registration', async () => {
    assert.deepEqual(await rowsSnapshot(),beforeRows);
    const after = new Map((await schemaSnapshot()).map(r => [r.kind + ':' + r.key,r.value]));
    for (const row of beforeSchema) assert.deepEqual(after.get(row.kind + ':' + row.key),row.value,row.key);
    assert.equal(await scalar('select count(*)::int from cron.job'),2);
    for (const t of tables) assert.equal(await scalar('select count(*)::int from private.' + t),0);
  });
  await check('actor-less residents and staff keep old access, get NULL actor, and bootstrap grants do not authorize A1 DML', async () => {
    for (const u of [a,b,staff]) assert.equal((await as(u,'select public.my_actor()')).rows[0].my_actor,null);
    assert.equal((await as(a,'select * from public.messages')).rowCount,1);
    assert.equal((await as(staff,'select public.staff_me()')).rows[0].staff_me.roles.length,1);
    await as(a,"select public.player_action('heartbeat')");
    await as(b,'select public.cast_vote($1,false)',[poll]);
    const due = await scalar('select id from public.dues where user_id=$1',[a]);
    await as(a,'select public.pay_dues($1)',[due]);
    assert.equal(await scalar('select balance from public.wallets where user_id=$1',[a]),150);
    assert.equal(await scalar('select treasury from public.buildings where id=$1',[building]),5150);
    assert.equal(await scalar('select count(*)::int from private.actors'),0);
  });
  await check('post-migration signup/profile trigger and invitation joining still work without creating actor or skill rows', async () => {
    const before = await rowsSnapshot(), rollback = new Error('fixture-only rollback');
    await assert.rejects(() => transaction(async c => {
      const newcomer = uuid();
      await c.query("insert into auth.users values($1,$2,now())",[newcomer,{username:'a1_new_resident'}]);
      await c.query('set local role authenticated');
      await c.query("select set_config('request.jwt.claim.sub',$1,true)",[newcomer]);
      await c.query("select public.join_building('a1-fixture')");
      assert.equal(await scalar('select balance from public.wallets where user_id=$1',[newcomer],c),300);
      assert.equal(await scalar('select public.my_actor()',[],c),null);
      throw rollback;
    }),e => e===rollback);
    assert.deepEqual(await rowsSnapshot(),before);
    assert.equal(await scalar('select count(*)::int from private.actors'),0);
  });
  const actorA = await transaction(c => player(c,a));
  await check('own read projection contains ONLY actor ID/kind and canonical skills; no IDOR parameter or peer/staff bypass', async () => {
    const data = (await as(a,'select public.my_actor()')).rows[0].my_actor;
    assert.deepEqual(data,{id:actorA,kind:'player',skills:Object.fromEntries(skills.map(s => [s,{level:0,xp:0}]))});
    assert.equal((await as(b,'select public.my_actor()')).rows[0].my_actor,null);
    assert.equal((await as(staff,'select public.my_actor()')).rows[0].my_actor,null);
    await denies(() => as('', 'select public.my_actor()'),['42501']);
    await denies(() => as(a,'select public.my_actor()',[],'anon'),['42501']);
    await denies(() => as(a,'select public.my_actor()',[],'service_role'),['42501']);
    await denies(() => as(a,'select public.my_actor($1)',[actorA]),['42883']);
  });
  await check('one actor per real resident; absent/nonresident profiles and mixed bot/player identities fail independently of TypeScript', async () => {
    await denies(() => transaction(c => player(c,a)),['23505']);
    await denies(() => transaction(c => player(c,staff)));
    await denies(() => transaction(c => player(c,uuid())),['23514','23503']);
    await denies(() => db.query("insert into private.actors(kind,profile_id) values('bot',$1)",[a]));
    await denies(() => db.query("insert into private.actors(kind) values('player')"));
    await denies(() => db.query("insert into private.actors(kind) values('bot')")); // deferred profile missing
    const h = await housing();
    await denies(() => transaction(c => c.query('insert into private.bot_profiles(actor_id,plan_id,home_id,display_name,role,field) values($1,$2,$3,$4,$5,$6)',
      [actorA,h.plan,h.homes[0],'Fixture','worker','plumbing'])),['23503']);
  });
  await check('player initialization is complete, zero/zero and immutable; bad ranges, unknown or duplicate skills fail', async () => {
    for (const [key,values] of [
      ['plumbing',[1,0]],['business',[0,1]],['plumbing',[-1,0]],['plumbing',[11,0]],['plumbing',[0,-1]],['plumbing',[0,'9007199254740992']]]) {
      const initial = Object.fromEntries(skills.map(s => [s,[0,0]])); initial[key]=values;
      await denies(() => transaction(c => player(c,b,uuid(),initial)));
    }
    await denies(() => transaction(c => player(c,b,uuid(),{plumbing:[0,0]})));
    await denies(() => db.query("insert into private.actor_skills values($1,'unknown',0,0)",[actorA]),['22P02']);
    await denies(() => db.query("insert into private.actor_skills values($1,'plumbing',0,0)",[actorA]),['23505']);
    await denies(() => db.query('update private.actor_skills set level=1 where actor_id=$1',[actorA]));
    await denies(() => db.query('delete from private.actor_skills where actor_id=$1',[actorA]));
    await denies(() => db.query('update private.actors set profile_id=$1 where id=$2',[b,actorA]));
    await denies(() => db.query('delete from private.actors where id=$1',[actorA]));
    assert.equal(await scalar('select count(*)::int from private.actors'),1);
  });
  await check('two concurrent player mappings cannot create duplicate actors or duplicate initial skills', async () => {
    const r = await Promise.allSettled([transaction(c => player(c,b)),transaction(c => player(c,b))]);
    assert.equal(r.filter(v => v.status==='fulfilled').length,1);
    assert.equal(r.find(v => v.status==='rejected').reason.code,'23505');
    assert.equal(await scalar('select count(*)::int from private.actors where profile_id=$1',[b]),1);
  });
  const pilot = await housing({scope:'pilot',limit:2});
  const plumber = await transaction(c => bot(c,pilot));
  const businessTeacher = await transaction(c => bot(c,pilot,{home:pilot.homes[1],field:'business',levels:{business:6,basic_teaching:5,advanced_teaching:3}}));
  await check('pilot stores exactly two fixed 6/5/3 lecturers in independent 12-home NPC housing without creating legacy identities or money', async () => {
    assert.equal(await scalar('select count(*)::int from private.npc_homes where plan_id=$1',[pilot.plan]),12);
    assert.equal(await scalar('select count(*)::int from private.bot_profiles where plan_id=$1',[pilot.plan]),2);
    for (const id of [plumber,businessTeacher]) {
      assert.equal(await scalar('select count(*)::int from auth.users where id=$1',[id]),0);
      assert.equal(await scalar('select count(*)::int from public.profiles where id=$1',[id]),0);
      assert.equal(await scalar('select count(*)::int from public.wallets where user_id=$1',[id]),0);
    }
    await denies(() => transaction(c => bot(c,pilot,{actor:plumber,home:pilot.homes[2]})),['23505']);
    await denies(() => transaction(c => bot(c,pilot,{home:pilot.homes[2]})));
    await denies(() => housing({scope:'pilot',limit:3}));
    await denies(() => housing({scope:'pilot',limit:2,capacity:13}));
  });
  await check('NPC boundaries: incomplete/out-of-range/duplicate homes, cross-plan links, human apartments and duplicate homes rejected', async () => {
    await denies(() => transaction(async c => {
      const p = uuid(); await c.query("insert into private.npc_population_plans(id,code,scope,population_limit) values($1,$2,'world',1)",[p,'test_' + p.replaceAll('-','')]);
      await c.query("insert into private.npc_buildings(plan_id,name,capacity) values($1,'Incomplete',12)",[p]);
    }));
    const world = await housing({limit:5,capacity:2});
    await transaction(c => bot(c,world,{role:'worker'}));
    await denies(() => transaction(c => bot(c,world,{role:'worker'})),['23505']);
    await denies(() => transaction(c => bot(c,world,{home:pilot.homes[2],role:'worker'})),['23503']);
    const humanHome = await scalar('select id from public.apartments limit 1');
    await denies(() => transaction(c => bot(c,world,{home:humanHome,role:'worker'})),['23503']);
    await denies(() => db.query('insert into private.npc_homes values($1,$2,$3,3)',[uuid(),world.plan,world.building]));
    await denies(() => db.query('insert into private.npc_homes values($1,$2,$3,1)',[uuid(),world.plan,world.building]),['23505']);
    await denies(() => db.query('update private.bot_profiles set home_id=$1 where actor_id=$2',[pilot.homes[3],plumber]));
    await denies(() => db.query('update private.npc_population_plans set population_limit=99 where id=$1',[pilot.plan]));
    // World population policy is explicit and may exceed the two-bot pilot.
    const larger = await housing({limit:3,capacity:3});
    for (const home of larger.homes) await transaction(c => bot(c,larger,{home,role:'worker'}));
    assert.equal(await scalar('select count(*)::int from private.bot_profiles where plan_id=$1',[larger.plan]),3);
  });
  await check('fixed bot skills enforce role allowlists, exact levels, no XP or unrelated abilities, with multi-field teaching preserved', async () => {
    const world = await housing({limit:20,capacity:20}); let i=0;
    for (const role of ['worker','operator']) for (const field of skills) {
      const levels = role==='worker' ? {[field]:3} : {[field]:4,business:4};
      const opts = {home:world.homes[i++],role,field,levels};
      await transaction(c => bot(c,world,opts));
      for (const extra of skills.filter(s => !Object.hasOwn(levels,s))) for (const level of [0,10])
        await denies(() => transaction(c => bot(c,world,{...opts,home:world.homes[19],levels:{...levels,[extra]:level}})));
    }
    await transaction(c => bot(c,world,{home:world.homes[i++],fields:skills,levels:Object.fromEntries(skills.map(s => [s,6]))}));
    for (const levels of [{plumbing:5,basic_teaching:5,advanced_teaching:3},{plumbing:6,basic_teaching:10,advanced_teaching:3}])
      await denies(() => transaction(c => bot(c,world,{home:world.homes[19],levels})));
    await denies(() => transaction(c => bot(c,world,{home:world.homes[19],xp:1})));
    await denies(() => transaction(c => bot(c,world,{home:world.homes[19],fields:['plumbing','plumbing']})));
    await denies(() => transaction(c => bot(c,world,{home:world.homes[19],levels:{plumbing:6,business:10,basic_teaching:5,advanced_teaching:3}})));
    await denies(() => db.query("update private.actor_skills set level=7 where actor_id=$1 and skill='plumbing'",[plumber]));
    await denies(() => db.query("update private.bot_profiles set role='worker' where actor_id=$1",[plumber]));
  });
  await check('concurrent population and home allocations serialize at READ COMMITTED and REPEATABLE READ', async () => {
    for (const isolation of ['read committed','repeatable read']) {
      for (const sameHome of [false,true]) {
        const h = await housing({limit:sameHome?2:1,capacity:2});
        const first = new pg.Client({connectionString:url.href}), second = new pg.Client({connectionString:url.href});
        await first.connect(); await second.connect();
        try {
          for (const c of [first,second]) {
            await c.query('begin isolation level '+isolation);
            await c.query("set local statement_timeout='10s'");
          }
          await bot(first,h,{role:'worker',home:h.homes[0]});
          // Establish a stale RR snapshot BEFORE the competing transaction commits.
          assert.equal(await scalar('select count(*)::int from private.bot_profiles where plan_id=$1',[h.plan],second),0);
          const pending = bot(second,h,{role:'worker',home:h.homes[sameHome?0:1]})
            .then(() => second.query('commit'));
          // Attach rejection handling immediately; no unhandled rejection during first COMMIT.
          const outcome = pending.then(() => null,e => e);
          await first.query('commit');
          const error = await outcome;
          assert.ok(error,'The competing allocation must fail');
          assert.equal(error.code,isolation==='repeatable read'?'40001':sameHome?'23505':'23514');
          await second.query('rollback');
        } finally {
          await first.query('rollback'); await second.query('rollback');
          await first.end(); await second.end();
        }
        assert.equal(await scalar('select count(*)::int from private.bot_profiles where plan_id=$1',[h.plan]),1);
      }
    }
  });
  await check('bot UUID cannot become a real resident, candidate, voter or manager; existing electorate and quorum stay human-only', async () => {
    const before = await rowsSnapshot();
    await denies(() => as(plumber,'select public.election_action($1,$2,$3)',[election,'nominate','Bot aday']),['P0001']);
    await denies(() => as(plumber,'select public.election_action($1,$2,$3)',[election,'vote',a]),['P0001']);
    await denies(() => as(plumber,'select public.cast_vote($1,true)',[poll]),['P0001']);
    await denies(() => db.query('insert into public.election_electorate values($1,$2,$3)',[election,plumber,building]),['23503']);
    const apartment = await scalar('select id from public.apartments where number=12');
    await denies(() => db.query('insert into public.memberships(user_id,building_id,apartment_id) values($1,$2,$3)',[plumber,building,apartment]),['23503']);
    await denies(() => db.query("insert into public.manager_terms(building_id,user_id,starts_at,ends_at) values($1,$2,now()+interval '20 days',now()+interval '34 days')",[building,plumber]),['23503']);
    assert.deepEqual(await rowsSnapshot(),before);
  });
  await check('all six tables deny API-role SELECT/INSERT/UPDATE/DELETE/TRUNCATE, including real super staff and forged metadata', async () => {
    for (const t of tables) {
      assert.equal(await scalar("select relrowsecurity from pg_class where oid=$1::regclass",['private.'+t]),true);
      for (const role of ['anon','authenticated','service_role']) {
        for (const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
          assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'private.'+t,privilege]),false);
        for (const sql of ['select * from ','delete from ','truncate '])
          await denies(() => as(staff,sql+'private.'+t,[],role),['42501']);
        await denies(() => as(staff,'insert into private.'+t+' default values',[],role),['42501']);
        const col = t==='actor_skills'?'level':t==='bot_profiles'?'display_name':t==='npc_homes'?'number':'id';
        await denies(() => as(staff,`update private.${t} set ${col}=${col}`,[],role),['42501']);
      }
    }
    // Demonstrate RLS independently of GRANT: accidental SELECT grant still exposes zero rows.
    try {
      for (const t of tables) await db.query('grant select on private.'+t+' to authenticated');
      for (const u of [a,b,staff]) for (const t of tables)
        assert.equal((await as(u,'select * from private.'+t)).rowCount,0);
    } finally { for (const t of tables) await db.query('revoke select on private.'+t+' from authenticated'); }
  });
  await check('internal functions cannot be executed and only checked self-read is exposed with empty search_path', async () => {
    const internals = (await db.query("select p.oid::regprocedure::text signature,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'a1_%'")).rows;
    assert.equal(internals.length,7);
    for (const fn of internals) for (const role of ['anon','authenticated','service_role'])
      assert.equal(await scalar('select has_function_privilege($1,$2,\'EXECUTE\')',[role,fn.signature]),false);
    await denies(() => as(a,'select private.a1_assert_actor($1)',[actorA]),['42501']);
    for (const name of ['private.my_actor()','public.my_actor()']) {
      const fn = (await db.query('select prosecdef,proconfig from pg_proc where oid=$1::regprocedure',[name])).rows[0];
      assert.ok(fn.proconfig.includes('search_path=""')); assert.equal(fn.prosecdef,name.startsWith('private.'));
    }
    // Ban applies to the new read RPC without introducing a new game mutation path.
    await as(staff,'select public.staff_sanction($1,$2,null,$3,$4)',[b,'ban',uuid(),'Disposable erişim kontrolü']);
    await denies(() => as(b,'select public.my_actor()'),['42501']);
    await as(staff,'select public.staff_sanction($1,$2,null,$3,$4)',[b,'unban',uuid(),'Disposable erişim geri alma']);
    assert.equal((await as(b,'select public.my_actor()')).rows[0].my_actor.kind,'player');
  });
  await check('all new actor/NPC writes leave every legacy row and financial ledger untouched', async () => {
    // Start a fresh preservation interval now, after intentional legacy regression calls.
    const before = await rowsSnapshot();
    const h = await housing({limit:1,capacity:1}); await transaction(c => bot(c,h,{role:'worker'}));
    assert.deepEqual(await rowsSnapshot(),before);
    const mismatch = await scalar(`select count(*)::int from public.wallets w where balance<>(
      select coalesce(sum(amount),0) from public.wallet_transactions t where t.user_id=w.user_id)`);
    assert.equal(mismatch,0);
    assert.equal(await scalar('select count(*)::int from public.memberships'),2);
    assert.equal(await scalar('select electorate_size from public.elections where id=$1',[election]),2);
  });
  console.log(`${count} A1 PostgreSQL integration groups passed. Auth HTTP/MFA/Realtime and actual pg_cron execution NOT tested. No hosted connections.`);
} finally {
  await db.end(); await admin.query('drop database apartman_a1 with (force)'); await admin.end();
}
