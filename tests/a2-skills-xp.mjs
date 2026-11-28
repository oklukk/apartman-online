// A2-1 disposable PostgreSQL only; source claims are NOT XP awards or real activities.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
const compiled=ts.transpileModule(await readFile('src/domain/actors/index.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validateInitialActorPlan}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const base='postgresql://postgres:local-test-only@127.0.0.1:55432/postgres';
const url=new URL(base);url.pathname='/apartman_a2';
const admin=new pg.Client({connectionString:base}),db=new pg.Client({connectionString:url.href});
const uuid=()=>crypto.randomUUID(),q=s=>'"'+s.replaceAll('"','""')+'"';
const scalar=async(sql,args=[],c=db)=>Object.values((await c.query(sql,args)).rows[0])[0];
let count=0;
const check=async(name,fn)=>{await fn();count++;console.log('PASS',name);};
const rejects=(fn,codes=['23514'])=>assert.rejects(fn,e=>{assert.ok(codes.includes(e.code),e.code+': '+e.message);return true;});
async function tx(fn,isolation='read committed'){
 assert.ok(['read committed','repeatable read'].includes(isolation));
 const c=new pg.Client({connectionString:url.href});await c.connect();
 try{await c.query('begin isolation level '+isolation);await c.query("set local statement_timeout='15s'");const r=await fn(c);await c.query('commit');return r;}
 catch(e){await c.query('rollback');throw e;}finally{await c.end();}
}
async function as(u,sql,args=[],role='authenticated'){
 assert.ok(['authenticated','anon','service_role'].includes(role));
 return tx(async c=>{await c.query('set local role '+role);await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[u,JSON.stringify({sub:u,aal:'aal2',user_metadata:{role:'super_admin'}})]);return c.query(sql,args);});
}
const define=(code,active=false,c=db)=>scalar('select private.define_skill($1,$2,$3,$4,$5)',[code,'Fixture alanı','Yalnız disposable test alanı',active,active],c);
const claim=(source,actor,skill='plumbing',c=db,type='fixture_training')=>scalar('select private.reserve_xp_source($1,$2,$3,$4,$5)',[type,source,actor,skill,'Disposable kaynak rezervasyonu'],c);
async function enroll(c,actor,skill){
 // Explicit isolated test authorization + canonical row. No runtime enrollment API exists.
 await c.query('insert into private.player_skill_enrollments(actor_id,skill_code,approval_ref,reason) values($1,$2,$3,$4)',[actor,skill,'fixture-approval','Fixture açık alan onayı']);
 await c.query('insert into private.actor_skills values($1,$2,0,0)',[actor,skill]);
}
async function fingerprints(tables){const r={};for(const{schemaname:s,tablename:t}of tables)r[s+'.'+t]=(await db.query(`select count(*)::int n,md5(coalesce(string_agg(row_to_json(r)::text,E'\n' order by row_to_json(r)::text),'')) hash from ${q(s)}.${q(t)} r`)).rows[0];return r;}
async function catalog(){return(await db.query(`select 'function' kind,p.oid::regprocedure::text key,jsonb_build_object('src',prosrc,'acl',proacl,'config',proconfig,'definer',prosecdef) value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth','cron')
 union all select 'policy',schemaname||'.'||tablename||'.'||policyname,to_jsonb(p) from pg_policies p
 union all select 'table',n.nspname||'.'||c.relname,jsonb_build_object('acl',relacl,'rls',relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','cron') and relkind in ('r','v')
 union all select 'trigger',tgrelid::regclass::text||'.'||tgname,to_jsonb(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal
 union all select 'publication',pubname,to_jsonb(p) from pg_publication p
 union all select 'publication_table',pubname||'.'||schemaname||'.'||tablename,to_jsonb(p) from pg_publication_tables p order by 1,2`)).rows;}
await admin.connect();await admin.query('create database apartman_a2');await db.connect();
try{
 for(const role of ['anon','authenticated','service_role'])if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await admin.query('create role '+role+' nologin');
 await db.query(`create schema auth;create schema extensions;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);create table auth.mfa_factors(user_id uuid references auth.users,status text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;create publication supabase_realtime;
 -- Scheduler registry stub only.
 create schema cron;create table cron.job(id bigint generated always as identity,jobname text unique,schedule text,command text);
 create function cron.schedule(n text,s text,c text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(n,s,c) returning id$$;`);
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();assert.equal(files.length,11);assert.match(files[10],/_a2_skill_catalog_xp_foundation\.sql$/);
 for(const f of files.slice(0,10)){await db.query('begin');await db.query((await readFile('supabase/migrations/'+f,'utf8')).replace(/create extension if not exists pg_cron with schema pg_catalog;/g,''));await db.query('commit');}
 const [a,b,c,staff]=[uuid(),uuid(),uuid(),uuid()];
 for(const[i,u]of[a,b,c,staff].entries())await db.query('insert into auth.users values($1,$2,now())',[u,{username:'a2_fixture_'+i}]);
 const building=await scalar("select id from public.buildings where slug='cinar'");
 await db.query("insert into private.invitations(building_id,code_hash,expires_at,uses_remaining) values($1,sha256(convert_to('a2-fixture','UTF8')),now()+interval '1 day',12)",[building]);
 for(const u of[a,b,c])await as(u,"select public.join_building('a2-fixture')");
 await as(a,"select public.player_action('job','technical')");await as(a,"select public.send_message('A2 öncesi korunan mesaj')");
 const poll=await scalar('select id from public.polls limit 1');await as(a,'select public.cast_vote($1,true)',[poll]);await db.query('select private.run_v02()');
 const election=await scalar('select id from public.elections limit 1');
 await db.query("insert into public.election_candidates(election_id,user_id,building_id,statement) values($1,$2,$3,'Korunan aday')",[election,a,building]);
 await db.query('insert into public.election_votes(election_id,user_id,candidate_id,building_id) values($1,$2,$2,$3)',[election,a,building]);
 await db.query("insert into public.dues(building_id,user_id,week_start,amount) values($1,$2,date_trunc('week',now() at time zone 'Europe/Istanbul')::date,150)",[building,a]);
 await db.query("insert into public.manager_terms(building_id,user_id,starts_at,ends_at) values($1,$2,now(),now()+interval '14 days')",[building,a]);
 await db.query("insert into auth.mfa_factors values($1,'verified')",[staff]);await db.query("select private.staff_bootstrap($1,'Disposable A2 sahibi')",[staff]);
 const actorA=await scalar('select private.ensure_player_actor($1)',[a]),actorB=await scalar('select private.ensure_player_actor($1)',[b]);
 const pilot={code:'fixture_pilot',scope:'pilot',population_limit:2,required_teaching_fields:['plumbing','business'],buildings:[{key:'fixture_building',name:'Fixture bina',capacity:12}],bots:[
  {key:'fixture_plumber',name:'Fixture eğitmen A',building_key:'fixture_building',home_number:1,role:'lecturer',field:'plumbing',teaching_fields:['plumbing'],levels:{plumbing:6,basic_teaching:5,advanced_teaching:3}},
  {key:'fixture_business',name:'Fixture eğitmen B',building_key:'fixture_building',home_number:2,role:'lecturer',field:'business',teaching_fields:['business'],levels:{business:6,basic_teaching:5,advanced_teaching:3}}]};
 const world=await scalar("select private.register_npc_world('a2_fixture_world','pilot',2,'test-ref','Disposable world')");
 const approval=await scalar('select private.approve_npc_plan($1,$2,$3,$4)',[world,pilot,'test-ref','Disposable pilot']);
 const npc=await scalar('select private.provision_npc_plan($1)',[approval]);
 const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','cron') order by 1,2")).rows;
 const before=await fingerprints(tables),schema=await catalog();
 const legacy=tables.filter(t=>!(t.schemaname==='private'&&['actors','actor_skills'].includes(t.tablename)));
 const legacyBefore=await fingerprints(legacy);
 const enumBefore=await scalar("select to_jsonb(enum_range(null::private.actor_skill_code))");
 await db.query('begin');await db.query(await readFile('supabase/migrations/'+files[10],'utf8'));await db.query('commit');
 const newTables=['skill_catalog','player_skill_enrollments','xp_source_claims'];
 await check('migration converts the real canonical key to TEXT/FK while preserving every old row/hash, value and unrelated RPC/security object',async()=>{
  assert.deepEqual(await fingerprints(tables),before);
  assert.equal(await scalar("select format_type(atttypid,atttypmod) from pg_attribute where attrelid='private.actor_skills'::regclass and attname='skill'"),'text');
  assert.equal(await scalar("select count(*)::int from pg_constraint where conname='actor_skills_catalog_fk' and confrelid='private.skill_catalog'::regclass"),1);
  assert.deepEqual(await scalar("select to_jsonb(enum_range(null::private.actor_skill_code))"),enumBefore);
  const after=new Map((await catalog()).map(r=>[r.kind+':'+r.key,r.value]));
  const changed=new Set(['private.a1_assert_actor(uuid)','private.npc_assert_teaching_coverage(uuid,private.actor_skill_code[])']);
  for(const row of schema){const value=after.get(row.kind+':'+row.key);if(row.kind==='function'&&changed.has(row.key)){
   assert.deepEqual({...value,src:row.value.src},row.value); // only reviewed function bodies may differ
  }else assert.deepEqual(value,row.value,row.key);}
  assert.equal(await scalar('select count(*)::int from private.skill_catalog'),4);
  assert.equal(await scalar('select count(*)::int from private.xp_source_claims'),0);
 });
 await check('new catalog codes are accepted without ENUM DDL and active/teachable metadata auto-enrolls nobody or starts no activity',async()=>{
  assert.equal(await define('fixture_extra',true),'fixture_extra');assert.equal(await define('fixture_extra',true),'fixture_extra');
  await define('fixture_inactive');
  assert.deepEqual(await fingerprints(tables),before);
  assert.deepEqual(await scalar("select to_jsonb(enum_range(null::private.actor_skill_code))"),enumBefore);
  assert.equal(await scalar('select count(*)::int from private.player_skill_enrollments'),0);
  await rejects(()=>claim(uuid(),actorA,'fixture_extra'),['23503']);
  for(const bad of ['', 'Bad_Code','bad-code','12bad'])await rejects(()=>define(bad));
  await rejects(()=>db.query("insert into private.skill_catalog(code,title_tr,is_initial) values('fixture_extra','Duplicate',false)"),['23505']);
  await rejects(()=>db.query("insert into private.skill_catalog(code,title_tr,is_initial) values('fixture_initial','Unapproved starter',true)"));
  await rejects(()=>db.query("update private.skill_catalog set code='renamed' where code='fixture_extra'"));
  await rejects(()=>db.query("delete from private.skill_catalog where code='fixture_extra'"));
 });
 await check('genuine extensibility: only explicit approved enrollment admits a new catalog TEXT code at 0/0 into the same canonical store',async()=>{
  await rejects(()=>db.query("insert into private.actor_skills values($1,'fixture_extra',0,0)",[actorA]));
  await rejects(()=>db.query("insert into private.actor_skills values($1,'undefined_code',0,0)",[actorA]),['23503']);
  await tx(client=>enroll(client,actorA,'fixture_extra'));
  assert.deepEqual((await db.query("select level,xp from private.actor_skills where actor_id=$1 and skill='fixture_extra'",[actorA])).rows,[{level:0,xp:'0'}]);
  const own=(await as(a,'select public.my_actor()')).rows[0].my_actor;assert.deepEqual(own.skills.fixture_extra,{level:0,xp:0});
  assert.equal(await scalar('select private.ensure_player_actor($1)',[a]),actorA); // replay never removes new enrollment
  await rejects(()=>tx(client=>enroll(client,actorA,'fixture_extra')),['23505']);
  await rejects(()=>db.query("delete from private.player_skill_enrollments where actor_id=$1",[actorA]));
  await rejects(()=>db.query("update private.actor_skills set level=10,xp=999 where actor_id=$1",[actorA]));
 });
 await check('A1 initial players still receive exactly four zero skills and pure-validator compatibility survives catalog growth',async()=>{
  assert.equal((await as(c,'select public.my_actor()')).rows[0].my_actor,null);
  assert.equal((await as(c,'select * from public.memberships')).rowCount,3);
  const id=await scalar('select private.ensure_player_actor($1)',[c]);const own=(await as(c,'select public.my_actor()')).rows[0].my_actor;
  assert.equal(Object.keys(own.skills).length,4);assert.equal(own.skills.fixture_extra,undefined);
  assert.deepEqual(validateInitialActorPlan({scope:'world',populationLimit:0,residentProfileIds:[c],players:[{kind:'player',id,profileId:c,skills:own.skills}],bots:[],buildings:[],homes:[],activeTeachingFields:[],zeroLevelLearningPaths:[],assignments:[]}),{ok:true,issues:[]});
  assert.deepEqual(await fingerprints(legacy),legacyBefore);
 });
 await check('A1 NPC creation/replay/coverage work through the retained ENUM bridge; fixed bot values cannot grow or receive claims',async()=>{
  assert.deepEqual(await scalar('select private.provision_npc_plan($1)',[approval]),npc);
  await db.query('select private.npc_assert_teaching_coverage($1,$2)',[npc.plan_id,['plumbing','business']]);
  const rollback=new Error('rollback new NPC compatibility fixture');
  await assert.rejects(()=>tx(async client=>{
   const nextWorld=await scalar("select private.register_npc_world('a2_after_world','pilot',2,'test-ref','New NPC compatibility')",[],client);
   const nextApproval=await scalar('select private.approve_npc_plan($1,$2,$3,$4)',[nextWorld,pilot,'test-ref','New NPC compatibility'],client);
   const next=await scalar('select private.provision_npc_plan($1)',[nextApproval],client);
   assert.equal(Object.keys(next.bots).length,2);
   await client.query('set constraints all immediate'); // Exercise all deferred checks against converted TEXT storage.
   throw rollback;
  }),e=>e===rollback);
  const bot=npc.bots.fixture_plumber;
  await rejects(()=>db.query("update private.actor_skills set level=7 where actor_id=$1 and skill='plumbing'",[bot]));
  await rejects(()=>db.query("insert into private.actor_skills values($1,'fixture_extra',0,0)",[bot]));
  await rejects(()=>tx(client=>enroll(client,bot,'fixture_extra')),['23503']);
  await rejects(()=>claim(uuid(),bot),['23503']);
  const bad=structuredClone(pilot);bad.bots[0].field='fixture_extra';bad.bots[0].teaching_fields=['fixture_extra'];
  bad.bots[0].levels={fixture_extra:6,basic_teaching:5,advanced_teaching:3};
  await rejects(()=>db.query('select private.approve_npc_plan($1,$2,$3,$4)',[world,bad,'test-ref','Unsupported NPC field']),['22P02']);
 });
 const source=uuid(),receipt=await claim(source,actorA),extraSource=uuid(),extraReceipt=await claim(extraSource,actorA,'fixture_extra');
 await check('source journal is unapplied, immutable and globally unique across actor, skill and source-type changes; it never credits XP',async()=>{
  const snapshot=await fingerprints([...tables,...newTables.map(tablename=>({schemaname:'private',tablename}))]);
  assert.equal(await claim(source,actorA),receipt);assert.deepEqual(await fingerprints([...tables,...newTables.map(tablename=>({schemaname:'private',tablename}))]),snapshot);
  await rejects(()=>claim(source,actorB));await rejects(()=>claim(source,actorA,'business'));await rejects(()=>claim(source,actorA,'plumbing',db,'fixture_book'));
  await rejects(()=>db.query('update private.xp_source_claims set actor_id=$1 where id=$2',[actorB,receipt]));
  await rejects(()=>db.query('delete from private.xp_source_claims where id=$1',[receipt]));
  await rejects(()=>db.query("insert into private.xp_source_claims(source_type,source_id,actor_id,skill_code,reason) values('fixture_book',$1,$2,'plumbing','Duplicate source')",[source,actorA]),['23505']);
  assert.equal(await scalar('select count(*)::int from private.actor_skills s join private.actors a on a.id=s.actor_id where a.kind=\'player\' and (xp<>0 or level<>0)'),0);
  assert.equal(await scalar("select count(*)::int from information_schema.columns where table_schema='private' and table_name='xp_source_claims' and column_name in ('amount','xp_amount','credited_at')"),0);
 });
 await check('server reservation day uses Turkey time, inactive codes reject new claims, and deactivation never erases existing values or claims',async()=>{
  assert.equal(await scalar("select reserved_on=(reserved_at at time zone 'Europe/Istanbul')::date from private.xp_source_claims where id=$1",[receipt]),true);
  await tx(client=>enroll(client,actorA,'fixture_inactive'));await rejects(()=>claim(uuid(),actorA,'fixture_inactive'));
  await db.query("update private.skill_catalog set is_active=false,is_teachable=false where code='fixture_extra'");
  assert.deepEqual((await as(a,'select public.my_actor()')).rows[0].my_actor.skills.fixture_extra,{level:0,xp:0});
  await rejects(()=>claim(uuid(),actorA,'fixture_extra'));
  assert.equal(await claim(source,actorA),receipt);
  assert.equal(await claim(extraSource,actorA,'fixture_extra'),extraReceipt);
  assert.equal(await scalar('select private.ensure_player_actor($1)',[a]),actorA);
 });
 await check('concurrent same-source claims return one ID at RC and RR retries whole without redirect or duplicate',async()=>{
  for(const isolation of ['read committed','repeatable read']){
   const id=uuid();const one=new pg.Client({connectionString:url.href}),two=new pg.Client({connectionString:url.href});await one.connect();await two.connect();
   try{await one.query('begin');await two.query('begin isolation level '+isolation);await two.query("set local statement_timeout='15s'");
    const first=await claim(id,actorA,'plumbing',one);assert.equal(await scalar('select count(*)::int from private.xp_source_claims where source_id=$1',[id],two),0);
    const pending=claim(id,actorA,'plumbing',two).then(value=>({value}),error=>({error}));await one.query('commit');const second=await pending;
    if(isolation==='read committed'){assert.equal(second.value,first);await two.query('commit');}else{assert.equal(second.error?.code,'40001');await two.query('rollback');assert.equal(await claim(id,actorA),first);}
    assert.equal(await scalar('select count(*)::int from private.xp_source_claims where source_id=$1',[id]),1);
   }finally{await one.query('rollback');await two.query('rollback');await one.end();await two.end();}
  }
  const id=uuid();const results=await Promise.allSettled([tx(client=>claim(id,actorA,'plumbing',client)),tx(client=>claim(id,actorB,'business',client))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'23514');
 });
 await check('failed/rolled-back source registration or partial enrollment leaves no claim, award or half canonical row',async()=>{
  const id=uuid(),marker=new Error('caller rollback');
  await assert.rejects(()=>tx(async client=>{await claim(id,actorA,'plumbing',client);throw marker;}),e=>e===marker);
  assert.equal(await scalar('select count(*)::int from private.xp_source_claims where source_id=$1',[id]),0);await claim(id,actorA);
  await define('fixture_partial',true);
  await rejects(()=>tx(client=>client.query("insert into private.player_skill_enrollments(actor_id,skill_code,approval_ref,reason) values($1,'fixture_partial','fixture-ref','Missing canonical row')",[actorA])),['23514','23503']);
  assert.equal(await scalar("select count(*)::int from private.player_skill_enrollments where skill_code='fixture_partial'"),0);
  assert.equal(await scalar("select count(*)::int from private.actor_skills where skill='fixture_partial'"),0);
 });
 await check('API roles and real super staff cannot write catalog/enrollment/claims or borrow owner privileges; RLS is independent of grants',async()=>{
  for(const role of ['anon','authenticated','service_role']){
   for(const t of newTables)for(const priv of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'private.'+t,priv]),false);
   await rejects(()=>as(staff,"select private.define_skill('unauthorized','Ad','Metin',true,true)",[],role),['42501']);
   await rejects(()=>as(staff,'select private.reserve_xp_source($1,$2,$3,$4,$5)',['fixture_type',uuid(),actorA,'plumbing','Bad direct claim'],role),['42501']);
   await rejects(()=>as(staff,'update private.actor_skills set xp=500,level=5 where actor_id=$1',[actorA],role),['42501']);
   for(const t of newTables){await rejects(()=>as(staff,'select * from private.'+t,[],role),['42501']);await rejects(()=>as(staff,'insert into private.'+t+' default values',[],role),['42501']);}
  }
  try{await db.query('grant execute on function private.a2_owner_check(),private.define_skill(text,text,text,boolean,boolean) to authenticated');
   await rejects(()=>as(staff,"select private.define_skill('still_unauthorized','Ad','Metin',true,true)"),['42501']);
   for(const t of newTables){await db.query('grant select on private.'+t+' to authenticated');assert.equal((await as(staff,'select * from private.'+t)).rowCount,0);}
  }finally{await db.query('revoke execute on function private.a2_owner_check(),private.define_skill(text,text,text,boolean,boolean) from authenticated');for(const t of newTables)await db.query('revoke select on private.'+t+' from authenticated');}
  assert.equal((await as(b,'select public.my_actor()')).rows[0].my_actor.id,actorB);
  await rejects(()=>as(b,'select public.my_actor($1)',[actorA]),['42883']);
 });
 await check('all old game/NPC rows and money ledgers remain identical; no level curve, award, education or scheduler was activated',async()=>{
  assert.deepEqual(await fingerprints(legacy),legacyBefore);
  assert.equal(await scalar('select count(*)::int from public.wallets w where balance<>(select coalesce(sum(amount),0) from public.wallet_transactions t where t.user_id=w.user_id)'),0);
  assert.equal(await scalar("select count(*)::int from private.actor_skills s join private.actors a on a.id=s.actor_id where a.kind='player' and (xp<>0 or level<>0)"),0);
 });
 console.log(`${count} A2 catalog/unapplied-source PostgreSQL groups passed. No XP credits, live connections or real Auth/MFA/Realtime/cron acceptance.`);
}finally{await db.end();await admin.query('drop database apartman_a2 with (force)');await admin.end();}
