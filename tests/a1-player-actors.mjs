// Disposable local PostgreSQL ONLY. No environment override, hosted access or backfill script.
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile('src/domain/actors/index.ts','utf8');
const js = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validateInitialActorPlan,SKILLS} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const base = 'postgresql://postgres:local-test-only@127.0.0.1:55432/postgres';
const url = new URL(base); url.pathname='/apartman_a1_player';
const admin = new pg.Client({connectionString:base}), db = new pg.Client({connectionString:url.href});
const uuid = () => crypto.randomUUID();
const scalar = async (sql,args=[],c=db) => Object.values((await c.query(sql,args)).rows[0])[0];
let count=0;
const check = async (name,fn) => {await fn();count++;console.log('PASS',name);};
const denies = (fn,code) => assert.rejects(fn,e => {assert.equal(e.code,code,e.message);return true;});
async function tx(fn,isolation='read committed') {
  assert.ok(['read committed','repeatable read'].includes(isolation));
  const c = new pg.Client({connectionString:url.href}); await c.connect();
  try {
    await c.query('begin isolation level '+isolation); await c.query("set local statement_timeout='10s'");
    const value=await fn(c);await c.query('commit');return value;
  } catch(e) {await c.query('rollback');throw e;} finally {await c.end();}
}
async function as(user,sql,args=[],role='authenticated') {
  assert.ok(['authenticated','anon','service_role'].includes(role));
  return tx(async c => {
    await c.query('set local role '+role);
    await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [user,JSON.stringify({sub:user,aal:'aal2',user_metadata:{role:'super_admin'}})]);
    return c.query(sql,args);
  });
}
const ensure = (profile,c=db) => scalar('select private.ensure_player_actor($1)',[profile],c);
const quote = s => '"'+s.replaceAll('"','""')+'"';
await admin.connect(); await admin.query('create database apartman_a1_player'); await db.connect();
try {
  for (const role of ['anon','authenticated','service_role']) if (!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)
    await admin.query('create role '+role+' nologin');
  await db.query(`create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
    create table auth.mfa_factors(user_id uuid references auth.users,status text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated,anon;grant execute on function auth.uid(),auth.jwt() to authenticated,anon;
    create publication supabase_realtime;
    -- Registration stub, not actual pg_cron execution.
    create schema cron;create table cron.job(jobid bigint generated always as identity,jobname text unique,schedule text,command text);
    create function cron.schedule(n text,s text,c text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid$$;`);
  const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
  assert.equal(files.length,9);assert.match(files[8],/_a1_player_actor_provisioning\.sql$/);
  for (const file of files.slice(0,8)) {
    const sql=(await readFile('supabase/migrations/'+file,'utf8')).replace(/create extension if not exists pg_cron with schema pg_catalog;/g,'');
    await db.query('begin');await db.query(sql);await db.query('commit');
  }
  const [a,b,c,d,e,f,staff]=Array.from({length:7},uuid);
  for (const [i,u] of [a,b,c,d,e,f,staff].entries()) await db.query('insert into auth.users values($1,$2,now())',[u,{username:'provision_'+i}]);
  const building=await scalar("select id from public.buildings where slug='cinar'");
  await db.query("insert into private.invitations(building_id,code_hash,expires_at,uses_remaining) values($1,sha256(convert_to('fixture-only','UTF8')),now()+interval '1 day',12)",[building]);
  for (const u of [a,b,c,d,e,f]) await as(u,"select public.join_building('fixture-only')");
  await as(a,"select public.player_action('job','technical')");
  await as(a,"select public.send_message('Aktör oluşturma öncesi mesaj')");
  const poll=await scalar('select id from public.polls limit 1');await as(a,'select public.cast_vote($1,true)',[poll]);
  await db.query('select private.run_v02()');
  await db.query("insert into public.dues(building_id,user_id,week_start,amount) values($1,$2,date_trunc('week',now() at time zone 'Europe/Istanbul')::date,150)",[building,a]);
  await db.query("insert into public.manager_terms(building_id,user_id,starts_at,ends_at) values($1,$2,now(),now()+interval '14 days')",[building,a]);
  await db.query("insert into auth.mfa_factors values($1,'verified')",[staff]);
  await db.query("select private.staff_bootstrap($1,'Disposable test sahibi')",[staff]);
  // An actor predating the new helper: replay must recognize it without any rewrite.
  const oldActor=uuid();
  await tx(async c => {
    await c.query("insert into private.actors(id,kind,profile_id) values($1,'player',$2)",[oldActor,a]);
    for (const skill of SKILLS) await c.query('insert into private.actor_skills values($1,$2,0,0)',[oldActor,skill]);
  });
  const existingTables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','cron') order by 1,2")).rows;
  async function snapshot(excludeActor=false) {
    const r={};
    for (const {schemaname:s,tablename:t} of existingTables) {
      if(excludeActor&&s==='private'&&['actors','actor_skills'].includes(t))continue;
      r[s+'.'+t]=(await db.query(`select count(*)::int n,md5(coalesce(string_agg(row_to_json(r)::text,E'\n' order by row_to_json(r)::text),'')) hash from ${quote(s)}.${quote(t)} r`)).rows[0];
    }
    return r;
  }
  async function schema() {
    return (await db.query(`select 'function' kind,n.nspname||'.'||p.oid::regprocedure::text key,
      jsonb_build_object('src',prosrc,'acl',proacl,'definer',prosecdef,'config',proconfig) value
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth','cron')
      union all select 'policy',schemaname||'.'||tablename||'.'||policyname,to_jsonb(p) from pg_policies p
      union all select 'trigger',tgrelid::regclass::text||'.'||tgname,to_jsonb(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal
      union all select 'table',n.nspname||'.'||c.relname,jsonb_build_object('acl',relacl,'rls',relrowsecurity)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','cron') and relkind in ('r','v')
      union all select 'publication',pubname,to_jsonb(p) from pg_publication p
      union all select 'publication_table',pubname||'.'||schemaname||'.'||tablename,to_jsonb(p) from pg_publication_tables p order by 1,2`)).rows;
  }
  const before=await snapshot(), beforeSchema=await schema(), legacy=await snapshot(true);
  await db.query('begin');await db.query(await readFile('supabase/migrations/'+files[8],'utf8'));await db.query('commit');
  await check('definition-only migration preserves every existing row/hash, RPC, policy, grant, trigger and cron/publication configuration',async()=>{
    assert.deepEqual(await snapshot(),before);
    const after=new Map((await schema()).map(r=>[r.kind+':'+r.key,r.value]));
    for(const r of beforeSchema)assert.deepEqual(after.get(r.kind+':'+r.key),r.value,r.key);
    assert.equal(await scalar('select count(*)::int from private.actors'),1);
  });
  await check('existing actor and lost-response replay return the same identity with byte-identical skills and no reward',async()=>{
    for(let i=0;i<3;i++)assert.equal(await ensure(a),oldActor);
    assert.deepEqual(await snapshot(),before);
    const created=await ensure(b); // Caller discards a successfully committed response.
    const committed=await snapshot();assert.equal(await ensure(b),created);assert.deepEqual(await snapshot(),committed);
  });
  await check('SQL canonical skills agree with the existing pure domain validator; no old profession converts to XP',async()=>{
    const actors=(await db.query("select id,profile_id from private.actors where kind='player' order by id")).rows;
    const players=[];
    for(const actor of actors){
      const rows=(await db.query('select skill,level,xp from private.actor_skills where actor_id=$1',[actor.id])).rows;
      assert.equal(rows.length,4);assert.ok(rows.every(s=>s.level===0&&s.xp==='0'));
      players.push({kind:'player',id:actor.id,profileId:actor.profile_id,skills:Object.fromEntries(rows.map(s=>[s.skill,{level:s.level,xp:Number(s.xp)}]))});
    }
    assert.deepEqual(validateInitialActorPlan({scope:'world',populationLimit:0,residentProfileIds:actors.map(a=>a.profile_id),players,bots:[],buildings:[],homes:[],activeTeachingFields:[],zeroLevelLearningPaths:[],assignments:[]}),{ok:true,issues:[]});
    assert.deepEqual(await snapshot(true),legacy);
  });
  await check('two concurrent requests at RC return one actor; stale RR retries whole and returns that same actor',async()=>{
    for(const [target,isolation] of [[c,'read committed'],[d,'repeatable read']]){
      const one=new pg.Client({connectionString:url.href}),two=new pg.Client({connectionString:url.href});await one.connect();await two.connect();
      try{
        await one.query('begin');await two.query('begin isolation level '+isolation);
        for(const client of [one,two])await client.query("set local statement_timeout='10s'");
        const first=await ensure(target,one);
        assert.equal(await scalar('select count(*)::int from private.actors where profile_id=$1',[target],two),0);
        const pending=ensure(target,two).then(value=>({value}),error=>({error}));
        await one.query('commit');const result=await pending;
        if(isolation==='read committed'){assert.equal(result.value,first);await two.query('commit');}
        else{assert.equal(result.error?.code,'40001');await two.query('rollback');assert.equal(await ensure(target),first);}
        assert.equal(await scalar('select count(*)::int from private.actors where profile_id=$1',[target]),1);
        assert.equal(await scalar('select count(*)::int from private.actor_skills where actor_id=$1',[first]),4);
      }finally{await one.query('rollback');await two.query('rollback');await one.end();await two.end();}
    }
  });
  await check('non-resident, unknown and null targets are rejected; staff metadata cannot create actor authority',async()=>{
    await denies(()=>ensure(staff),'42501');await denies(()=>ensure(uuid()),'42501');await denies(()=>ensure(null),'22004');
    for(const role of ['anon','authenticated','service_role']){
      assert.equal(await scalar("select has_function_privilege($1,'private.ensure_player_actor(uuid)','EXECUTE')",[role]),false);
      for(const user of [a,staff])await denies(()=>as(user,'select private.ensure_player_actor($1)',[e],role),'42501');
    }
    await denies(()=>as(a,'select public.ensure_player_actor($1)',[e]),'42883');
    // Even an accidental EXECUTE grant cannot make this invoker function lend owner power.
    try{await db.query('grant execute on function private.ensure_player_actor(uuid) to authenticated');
      await denies(()=>as(staff,'select private.ensure_player_actor($1)',[e]),'42501');
    }finally{await db.query('revoke execute on function private.ensure_player_actor(uuid) from authenticated');}
    const fn=(await db.query("select prosecdef,provolatile,proconfig from pg_proc where oid='private.ensure_player_actor(uuid)'::regprocedure")).rows[0];
    assert.equal(fn.prosecdef,false);assert.equal(fn.provolatile,'v');assert.ok(fn.proconfig.includes('search_path=""'));
  });
  await check('active target ban rejects initialization under the existing sanction lock without fabricating an Auth session',async()=>{
    await denies(()=>tx(async client=>{
      await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[staff,JSON.stringify({sub:staff,aal:'aal2'})]);
      await client.query("select public.staff_sanction($1,'ban',null,$2,'Fixture yaptırım kontrolü')",[e,uuid()]);
      await ensure(e,client);
    }),'42501');
    assert.deepEqual(await snapshot(true),legacy);
  });
  await check('mid-skill failure rolls back the entire call; retry creates exactly one complete actor',async()=>{
    await db.query(`create function private.test_skill_fault() returns trigger language plpgsql as $$begin
      if new.skill='business' then raise exception 'TEST_SKILL_FAILURE';end if;return new;end$$;
      create trigger test_skill_fault before insert on private.actor_skills for each row execute function private.test_skill_fault();`);
    try{await denies(()=>ensure(e),'P0001');}
    finally{await db.query('drop trigger test_skill_fault on private.actor_skills;drop function private.test_skill_fault()');}
    assert.equal(await scalar('select count(*)::int from private.actors where profile_id=$1',[e]),0);
    // An incomplete trusted snapshot is rejected, never silently repaired or overwritten.
    await denies(()=>tx(async client=>{
      await client.query("insert into private.actors(kind,profile_id) values('player',$1)",[e]);await ensure(e,client);
    }),'23514');
    const actor=await ensure(e);assert.equal(await ensure(e),actor);
    assert.equal(await scalar('select count(*)::int from private.actor_skills where actor_id=$1',[actor]),4);
  });
  await check('failure at COMMIT or caller rollback leaves no half actor; later retry is safe',async()=>{
    await db.query(`create function private.test_commit_fault() returns trigger language plpgsql as $$begin raise exception 'TEST_COMMIT_FAILURE';end$$;
      create constraint trigger test_commit_fault after insert on private.actors deferrable initially deferred for each row execute function private.test_commit_fault();`);
    try{await denies(()=>tx(client=>ensure(f,client)),'P0001');}
    finally{await db.query('drop trigger test_commit_fault on private.actors;drop function private.test_commit_fault()');}
    assert.equal(await scalar('select count(*)::int from private.actors where profile_id=$1',[f]),0);
    const rollback=new Error('caller failure before commit');
    await assert.rejects(()=>tx(async client=>{await ensure(f,client);throw rollback;}),err=>err===rollback);
    assert.equal(await scalar('select count(*)::int from private.actors where profile_id=$1',[f]),0);
    await ensure(f);
  });
  await check('leaving retains identity/skills, denies ensure, and rejoining uses the old actor; account deletion cannot cascade it away',async()=>{
    const actor=await ensure(f), record=(await as(f,'select public.my_actor()')).rows[0].my_actor;
    const rollback=new Error('rollback departure fixture');
    await assert.rejects(()=>tx(async client=>{
      const membership=(await client.query('select row_to_json(m) record from public.memberships m where user_id=$1',[f])).rows[0].record;
      await client.query('delete from public.memberships where user_id=$1',[f]);
      await client.query('savepoint departed');
      await denies(()=>ensure(f,client),'42501');await client.query('rollback to savepoint departed');
      assert.equal(await scalar('select id from private.actors where profile_id=$1',[f],client),actor);
      // Remove only this disposable account's old financial references, so the actor FK is the remaining blocker.
      await client.query('delete from public.election_electorate where user_id=$1',[f]);
      await client.query('delete from public.wallet_transactions where user_id=$1',[f]);
      await client.query('delete from public.wallets where user_id=$1',[f]);
      await client.query('savepoint deleting');
      await assert.rejects(()=>client.query('delete from auth.users where id=$1',[f]),err=>err.code==='23503'&&err.constraint==='actors_profile_id_fkey');
      await client.query('rollback to savepoint deleting');
      await client.query('insert into public.memberships select * from json_populate_record(null::public.memberships,$1::json)',[JSON.stringify(membership)]);
      assert.equal(await ensure(f,client),actor);
      throw rollback;
    }),err=>err===rollback);
    assert.deepEqual((await as(f,'select public.my_actor()')).rows[0].my_actor,record);
    assert.deepEqual(await snapshot(true),legacy);
  });
  await check('membership removed while initialization waits is rechecked; no departed resident is initialized',async()=>{
    // Keep server timestamp precision when restoring this deliberately deleted fixture.
    const member=(await db.query('select row_to_json(m) record from public.memberships m where user_id=$1',[f])).rows[0].record;
    const one=new pg.Client({connectionString:url.href}),two=new pg.Client({connectionString:url.href});await one.connect();await two.connect();
    try{
      await one.query('begin');await two.query('begin');
      await two.query("set local statement_timeout='10s'");
      await one.query('delete from public.memberships where user_id=$1',[f]);
      const pid=await scalar('select pg_backend_pid()',[],two);
      const pending=ensure(f,two).then(value=>({value}),error=>({error}));
      let locked=false;
      for(let i=0;i<100;i++){
        locked=await scalar("select coalesce(wait_event_type='Lock',false) from pg_stat_activity where pid=$1",[pid]);
        if(locked)break;
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.equal(locked,true,'Initialization must wait for the concurrent membership deletion');
      await one.query('commit');assert.equal((await pending).error?.code,'40001');await two.query('rollback');
    }finally{
      await one.query('rollback');await two.query('rollback');await one.end();await two.end();
      if(!await scalar('select count(*)::int from public.memberships where user_id=$1',[f]))
        await db.query('insert into public.memberships select * from json_populate_record(null::public.memberships,$1::json)',[JSON.stringify(member)]);
    }
    assert.deepEqual(await snapshot(true),legacy);
  });
  await check('only player actor/skill rows changed; old ledgers, elections, grants, NPC plans/homes and scheduler stayed identical',async()=>{
    assert.deepEqual(await snapshot(true),legacy);
    assert.equal(await scalar('select count(*)::int from private.actors'),6);
    assert.equal(await scalar('select count(*)::int from private.actor_skills'),24);
    assert.equal(await scalar("select count(*)::int from private.actors where kind='bot'"),0);
    assert.equal(await scalar('select count(*)::int from public.wallets w where balance<>(select coalesce(sum(amount),0) from public.wallet_transactions t where t.user_id=w.user_id)'),0);
  });
  console.log(`${count} player actor PostgreSQL integration groups passed. No live connections. Auth HTTP/MFA/Realtime and actual cron execution NOT tested.`);
}finally{await db.end();await admin.query('drop database apartman_a1_player with (force)');await admin.end();}
