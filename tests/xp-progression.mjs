// Disposable PostgreSQL ONLY. No hosted URL/config, real actors or content seed.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
pg.types.setTypeParser(1082,value=>value); // DATE is a calendar key, never a host-timezone Date.
const {modules}=JSON.parse(await readFile('tests/fixtures/learning/starter-modules.json','utf8'));
const base='postgresql://postgres:local-test-only@127.0.0.1:55432/postgres';
const url=new URL(base);url.pathname='/apartman_a22b_xp';
const admin=new pg.Client({connectionString:base}),db=new pg.Client({connectionString:url.href});
const uuid=()=>crypto.randomUUID(),quote=s=>'"'+s.replaceAll('"','""')+'"';
const scalar=async(sql,args=[],c=db)=>Object.values((await c.query(sql,args)).rows[0])[0];
let count=0;
const check=async(name,fn)=>{await fn();count++;console.log('PASS',name);};
let inIsolated=false;
const rejects=async(fn,codes=['23514'])=>{
 if(inIsolated)await db.query('savepoint expected_failure');
 try{await assert.rejects(fn,e=>{assert.ok(codes.includes(e.code),e.code+': '+e.message);return true;});}
 finally{if(inIsolated){await db.query('rollback to savepoint expected_failure');await db.query('release savepoint expected_failure');}}
};
async function tx(fn,isolation='read committed'){
 assert.ok(['read committed','repeatable read','serializable'].includes(isolation));
 const c=new pg.Client({connectionString:url.href});await c.connect();
 try{await c.query('begin isolation level '+isolation);await c.query("set local statement_timeout='12s'");const r=await fn(c);await c.query('commit');return r;}
 catch(e){await c.query('rollback');throw e;}finally{await c.end();}
}
async function as(u,sql,args=[],role='authenticated'){
 assert.ok(['authenticated','anon','service_role'].includes(role));
 return tx(async c=>{await c.query('set local role '+role);await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[u,JSON.stringify({sub:u,aal:'aal2',user_metadata:{role:'postgres',completed:true,xp:999999}})]);return c.query(sql,args);});
}
const stage=(actor,m,answer=m.expectedAnswer,c=db,version=m.version)=>scalar('select private.stage_learning_evidence_draft($1,$2,$3,$4)',[actor,m.code,version,answer],c);
const sourceId=(actor,m,c=db)=>scalar('select private.learning_source_id($1,$2)',[actor,m.code],c);
async function hashes(tables){const out={};for(const{schemaname:s,tablename:t}of tables)out[s+'.'+t]=(await db.query(`select count(*)::int n,md5(coalesce(string_agg(to_jsonb(r)::text,E'\n' order by to_jsonb(r)::text),'')) hash from ${quote(s)}.${quote(t)} r`)).rows[0];return out;}
async function oldSchema(){return(await db.query(`select 'function' kind,p.oid::text key,jsonb_build_object('def',pg_get_functiondef(p.oid),'acl',p.proacl) value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth','cron')
 union all select 'trigger',oid::text,to_jsonb(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal
 union all select 'policy',schemaname||'.'||tablename||'.'||policyname,to_jsonb(p) from pg_policies p
 union all select 'table',c.oid::text,jsonb_build_object('acl',relacl,'rls',relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth','cron')and relkind in('r','v')
 union all select 'publication',pubname,to_jsonb(p)from pg_publication p
 union all select 'publication_table',pubname||'.'||schemaname||'.'||tablename,to_jsonb(p)from pg_publication_tables p order by 1,2`)).rows;}
async function loadDraft(m,c=db){
 await c.query('insert into private.learning_modules(code,skill_code,ordinal,prerequisite_code)values($1,$2,$3,$4)',[m.code,m.skill,m.ordinal,m.prerequisite]);
 await draftVersion(m,c);
}
async function draftVersion(m,c=db){await c.query(`insert into private.learning_module_drafts(module_code,version,title_tr,description_tr,goal_tr,task_tr,success_criterion_tr,prompt,assessment_kind,expected_answer,success_feedback_tr,failure_feedback_tr)
 values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[m.code,m.version,m.titleTr,m.descriptionTr,m.goalTr,m.taskTr,m.successCriterionTr,m.prompt,m.assessmentKind,m.expectedAnswer,m.successFeedbackTr,m.failureFeedbackTr]);}
await admin.connect();await admin.query('create database apartman_a22b_xp');await db.connect();
try{
 for(const role of['anon','authenticated','service_role'])if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await admin.query('create role '+role+' nologin');
 await db.query(`create schema auth;create schema extensions;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);create table auth.mfa_factors(user_id uuid references auth.users,status text);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt()to anon,authenticated;create publication supabase_realtime;
 -- Registry stub only; no real scheduler daemon or worker.
 create schema cron;create table cron.job(id bigint generated always as identity,jobname text unique,schedule text,command text);
 create function cron.schedule(n text,s text,c text)returns bigint language sql as $$insert into cron.job(jobname,schedule,command)values(n,s,c)returning id$$;`);
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();assert.equal(files.length,14);
assert.match(files[12],/_a22a_passive_learning_foundation\.sql$/);
 for(const f of files.slice(0,12)){await db.query('begin');await db.query((await readFile('supabase/migrations/'+f,'utf8')).replace(/create extension if not exists pg_cron with schema pg_catalog;/g,''));await db.query('commit');}
 const [a,b,actorless,outsider,staff]=[uuid(),uuid(),uuid(),uuid(),uuid()];
 for(const[i,u]of[a,b,actorless,outsider,staff].entries())await db.query('insert into auth.users values($1,$2,now())',[u,{username:'a22a_fixture_'+i}]);
 const building=await scalar("select id from public.buildings where slug='cinar'");
 await db.query("insert into private.invitations(building_id,code_hash,expires_at,uses_remaining)values($1,sha256(convert_to('learning-fixture','UTF8')),now()+interval '1 day',12)",[building]);
 for(const u of[a,b,actorless])await as(u,"select public.join_building('learning-fixture')");
 await as(a,"select public.player_action('job','technical')");await as(a,"select public.send_message('Korunan öğrenme öncesi mesaj')");
 const poll=await scalar('select id from public.polls limit 1');await as(a,'select public.cast_vote($1,true)',[poll]);await db.query('select private.run_v02()');
 const election=await scalar('select id from public.elections limit 1');
 await db.query("insert into public.election_candidates(election_id,user_id,building_id,statement)values($1,$2,$3,'Korunan aday')",[election,a,building]);
 await db.query('insert into public.election_votes(election_id,user_id,candidate_id,building_id)values($1,$2,$2,$3)',[election,a,building]);
 await db.query("insert into public.dues(building_id,user_id,week_start,amount)values($1,$2,date_trunc('week',now()at time zone 'Europe/Istanbul')::date,150)",[building,a]);
 await db.query("insert into auth.mfa_factors values($1,'verified')",[staff]);await db.query("select private.staff_bootstrap($1,'Disposable öğrenme sahibi')",[staff]);
 const actorA=await scalar('select private.ensure_player_actor($1)',[a]),actorB=await scalar('select private.ensure_player_actor($1)',[b]);
 const oldSource=uuid(),oldClaim=await scalar("select private.reserve_xp_source('fixture_training',$1,$2,'plumbing','Korunan kaynak')",[oldSource,actorA]);
 const spec={code:'learning_fixture_plan',scope:'pilot',population_limit:2,required_teaching_fields:['plumbing','business'],buildings:[{key:'learning_fixture_building',name:'Disposable NPC binası',capacity:12}],bots:['plumbing','business'].map((field,i)=>({key:'fixture_'+field,name:'Disposable eğitmen '+i,building_key:'learning_fixture_building',home_number:i+1,role:'lecturer',field,teaching_fields:[field],levels:{[field]:6,basic_teaching:5,advanced_teaching:3}}))};
 const world=await scalar("select private.register_npc_world('learning_fixture_world','pilot',2,'fixture-ref','Disposable nüfus')");
 const approval=await scalar("select private.approve_npc_plan($1,$2,'fixture-ref','Disposable onay')",[world,spec]);await db.query('select private.provision_npc_plan($1)',[approval]);
 const bot=await scalar('select actor_id from private.bot_profiles limit 1');

 await db.query('begin');await db.query(await readFile('supabase/migrations/'+files[12],'utf8'));await db.query('commit');
 for(const m of modules)await loadDraft(m);
 const draftClaim=await stage(actorA,modules[0]);
 const extra=[];
 for(let i=0;i<9;i++){
  const u=uuid();await db.query('insert into auth.users values($1,$2,now())',[u,{username:'xp_fixture_'+i}]);
  await as(u,"select public.join_building('learning-fixture')");
  extra.push({u,actor:await scalar('select private.ensure_player_actor($1)',[u])});
 }
 // A pre-migration claim with EVEN the future exact namespace/reason must stay unapplied.
 const oldExactSource=await scalar(`select(substr(h,1,12)||'8'||substr(h,14,3)||'8'||substr(h,18,15))::uuid from(select encode(sha256(convert_to('apartman/verified-learning/v1/'||$1::text||'/business.book.24','UTF8')),'hex')h)s`,[actorB]);
 const oldExactClaim=await scalar("select private.reserve_xp_source('verified_learning',$1,$2,'business','verified completion:business.book.24')",[oldExactSource,actorB]);
 const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in('public','private','auth','cron')order by 1,2")).rows;
 const before=await hashes(tables),schemaBefore=await oldSchema();
 const migration=await readFile('supabase/migrations/'+files[13],'utf8');
 assert.match(files[13],/_a22b_approved_xp_progression\.sql$/);
 await check('migration rollback and commit preserve ALL legacy rows, claims, NPCs, old ACL/RLS, cron and public API',async()=>{
  await db.query('begin');await db.query(migration);await db.query('rollback');
  assert.equal(await scalar("select to_regclass('private.xp_policies')"),null);assert.deepEqual(await hashes(tables),before);
  await db.query('begin');await db.query(migration);await db.query('commit');assert.deepEqual(await hashes(tables),before);
  const schema=await oldSchema();
  const replaced=(await db.query("select oid::text from pg_proc where oid in('private.a1_assert_actor(uuid)'::regprocedure,'private.a1_fixed_row_guard()'::regprocedure)")).rows.map(r=>r.oid);
  for(const e of schemaBefore)if(!(e.kind==='function'&&replaced.includes(e.key)))assert.deepEqual(schema.find(s=>s.kind===e.kind&&s.key===e.key),e);
 });
 const newTables=['xp_policies','xp_runtime','xp_completion_definitions','xp_verified_completions','xp_completion_revocations','xp_award_receipts'];
 await check('approved exact numbers, empty content/proofs/receipts, disabled runtime; no player/API/service role path',async()=>{
  const p=(await db.query('select * from private.xp_policies')).rows[0];
  assert.deepEqual(p.thresholds.map(Number),[0,20,60,140,260,440,700,1080,1640,2440,3540]);
  assert.deepEqual(p.rewards,{orientation:12,starter:32,course:24,book:8,practice:18});
  assert.deepEqual([p.general_daily,p.skill_daily,p.practice_daily,p.practice_weekly],[110,70,2,7]);
  assert.equal(await scalar('select mode from private.xp_runtime'),'disabled');
  for(const t of newTables.slice(2))assert.equal(await scalar('select count(*)::int from private.'+t),0);
  await rejects(()=>db.query('select private.award_verified_xp($1)',[draftClaim]),['42501']);
  await rejects(()=>db.query("insert into private.xp_policies select policy_id,2,array[0,21,60,140,260,440,700,1080,1640,2440,3540]::bigint[],rewards,general_daily,skill_daily,practice_daily,practice_weekly,approval_ref,created_at from private.xp_policies"));
  const funcs=(await db.query("select p.oid::regprocedure::text signature,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and(proname like 'xp_%'or proname in('record_test_xp_completion','award_verified_xp'))")).rows;
  for(const f of funcs){assert.equal(f.prosecdef,false);assert.ok(f.proconfig.some(s=>s==='search_path=""'));}
  for(const role of['anon','authenticated','service_role']){
   for(const t of newTables){assert.equal(await scalar('select relrowsecurity from pg_class where oid=$1::regclass',['private.'+t]),true);for(const permission of['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'private.'+t,permission]),false);}
   for(const f of funcs)assert.equal(await scalar("select has_function_privilege($1,$2,'EXECUTE')",[role,f.signature]),false);
   await rejects(()=>as(staff,'select private.award_verified_xp($1)',[draftClaim],role),['42501']);
  }
  assert.equal(await scalar("select count(*)::int from pg_policies where tablename like 'xp_%'"),0);
  assert.equal(await scalar("select to_regprocedure('public.award_verified_xp(uuid)')"),null);
 });
 await db.query("update private.xp_runtime set mode='disposable_only'");
 // Only test code replaces this CLOSED server-clock function. There is no client time/GUC parameter.
 const clock=async(t,c=db)=>{assert.match(t,/^20[0-9-]{8}T[0-9:.]+Z$/);await c.query(`create or replace function private.xp_server_now()returns timestamptz language sql volatile security invoker set search_path=''as $$select '${t}'::timestamptz$$`);};
 const day=(d,time='09:00:00')=>`2026-12-${String(d).padStart(2,'0')}T${time}Z`;
 const def=async(code,skill,kind,starter=null)=>db.query('insert into private.xp_completion_definitions(code,skill_code,activity_kind,starter_module)values($1,$2,$3,$4)',[code,skill,kind,starter]);
 for(const m of modules)await def(m.code,m.skill,'starter',m.code);
 for(const skill of['plumbing','business','basic_teaching','advanced_teaching']){
  await def(skill+'.orientation',''+skill,'orientation');
  for(let i=1;i<=24;i++)for(const kind of['book','course','practice'])await def(skill+'.'+kind+'.'+i,skill,kind);
 }
 const refs=new Map();
 const completion=(actor,code,c=db)=>{const k=actor+'/'+code;if(!refs.has(k))refs.set(k,uuid());return scalar('select private.record_test_xp_completion($1,$2,$3,$4)',[actor,code,refs.get(k),Buffer.alloc(32,17)],c);};
 const award=async(claim,c=db)=>(await c.query('select * from private.award_verified_xp($1)',[claim])).rows[0];
 const earn=async(actor,code,c=db)=>award(await completion(actor,code,c),c);
 const state=async(actor,skill,c=db)=>(await c.query('select level,xp::text from private.actor_skills where actor_id=$1 and skill=$2',[actor,skill])).rows[0];
 const isolated=async(fn)=>{await db.query('begin');inIsolated=true;try{await fn(db);}finally{inIsolated=false;await db.query('rollback');}};
 await clock(day(1));
 await check('draft claims, raw/random source UUID, non-existent completions and client amount have no award authority',async()=>{
  for(const id of[draftClaim,oldClaim,uuid()])await rejects(()=>award(id));
  await rejects(()=>def('plumbing.starter.alias','plumbing','starter',modules[0].code));
  await rejects(()=>def('business.starter.alias','business','starter',modules[0].code));
  await rejects(()=>db.query('select private.award_verified_xp($1,999)',[draftClaim]),['42883']);
  await rejects(()=>completion(bot,'plumbing.book.1'),['42501']);
  await rejects(()=>db.query('select private.record_test_xp_completion($1,$2,$3,$4)',[actorB,'plumbing.book.1',uuid(),Buffer.alloc(32)]));
  await rejects(()=>db.query('select private.record_test_xp_completion($1,$2,$3,$4)',[actorB,'plumbing.book.1',uuid(),null]),['23502']);
  await rejects(()=>completion(actorB,'business.book.24'));
  assert.equal(await scalar('select count(*)::int from private.xp_verified_completions where claim_id=$1',[oldExactClaim]),0);
  assert.equal(await scalar('select count(*)::int from private.xp_award_receipts'),0);
 });
 await check('0–3 progression: distinct real starter evidence +140 XP, separate orientation once; no free32 XP gap fill',async()=>{
  await clock(day(1));await earn(actorA,'plumbing.orientation');const one=await earn(actorA,modules[0].code);assert.equal(one.awarded_xp,32);assert.deepEqual(await state(actorA,'plumbing'),{level:1,xp:'44'});
  await rejects(()=>completion(actorA,modules[2].code));
  await clock(day(2));await earn(actorA,modules[1].code);await earn(actorA,modules[2].code);assert.deepEqual(await state(actorA,'plumbing'),{level:2,xp:'108'});
  await clock(day(3));await earn(actorA,'plumbing.course.1');const last=await earn(actorA,'plumbing.book.1');assert.deepEqual(await state(actorA,'plumbing'),{level:3,xp:'140'});
  assert.equal(last.starter_count,3);assert.equal(last.next_xp,'140');assert.equal(last.policy_version,1);
  assert.equal(last.earned_on.slice(0,4),'2026');assert.equal(last.evidence_hash.length,32);
  await rejects(()=>completion(actorA,'business.orientation'),['23514','23505']);
 });
 await check('XP-only140 never bypasses missing starter achievements; unopened 4–10/banking/overflow refuse without source consumption',async()=>isolated(async()=>{
  const actor=extra[0].actor;await clock(day(1));await earn(actor,'business.orientation');
  for(let i=1;i<=16;i++){await clock(day(2+Math.floor((i-1)/8)));await earn(actor,'business.book.'+i);}
  assert.deepEqual(await state(actor,'business'),{level:2,xp:'140'});
  await clock(day(7));const claim=await completion(actor,'business.book.17');
  const receipts=await scalar('select count(*)::int from private.xp_award_receipts');await rejects(()=>award(claim));
  assert.equal(await scalar('select count(*)::int from private.xp_award_receipts'),receipts);
  assert.equal(await scalar('select count(*)::int from private.xp_source_claims where id=$1',[claim]),1);
  assert.equal(await scalar('select count(*)::int from private.xp_award_receipts where claim_id=$1',[claim]),0);
 }));
 await check('no raw XP, level, identity, chain editing, deletion or truncation; ensure_player_actor preserves progressed values',async()=>{
  for(const sql of["update private.actor_skills set xp=139 where actor_id=$1 and skill='plumbing'","update private.actor_skills set level=10 where actor_id=$1 and skill='plumbing'","update private.actor_skills set xp=141 where actor_id=$1 and skill='plumbing'"]){await rejects(()=>db.query(sql,[actorA]));}
  await rejects(()=>db.query('update private.actor_skills set xp=1 where actor_id=$1',[bot]));
  await rejects(()=>as(a,'update private.actor_skills set xp=1 where actor_id=$1',[actorA]),['42501']);
  for(const t of newTables.filter(t=>t!=='xp_runtime')){
   if(await scalar('select count(*)::int from private.'+t))await rejects(()=>db.query('delete from private.'+t));
   await rejects(()=>db.query('truncate private.'+t+' cascade'));
  }
  await rejects(()=>db.query('truncate private.actor_skills cascade'));
  assert.equal(await scalar('select private.ensure_player_actor($1)',[a]),actorA);
  assert.deepEqual(await state(actorA,'plumbing'),{level:3,xp:'140'});await db.query('select private.a1_assert_actor($1)',[actorA]);await db.query('select private.a1_assert_actor($1)',[bot]);
  await rejects(()=>tx(async c=>{await c.query('update private.actor_skills set level=4,xp=260 where actor_id=$1',[extra[0].actor]);}));
 });
 await check('policy is immutable, version switch does not reset receipt replay/day counters; disabled state fails closed',async()=>isolated(async()=>{
  await clock(day(9));const actor=extra[0].actor;const c1=await completion(actor,'business.book.1');const first=await award(c1);
  await db.query("insert into private.xp_policies select policy_id,2,thresholds,rewards,general_daily,skill_daily,practice_daily,practice_weekly,'Disposable version2 same approved numbers',created_at from private.xp_policies where version=1");
  await db.query('update private.xp_runtime set policy_version=2');assert.deepEqual(await award(c1),first);
  await earn(actor,'business.course.1');await earn(actor,'business.course.2');await earn(actor,'business.book.2');
  const next=await completion(actor,'business.book.3');await rejects(()=>award(next)); //64+8>70
  assert.equal(await scalar('select policy_version from private.xp_award_receipts where claim_id=$1',[c1]),1);
  await db.query("update private.xp_runtime set mode='disabled'");await rejects(()=>award(next),['42501']);
 }));
 await check('actual award day differs from reservation; Turkey midnight/week helpers, repeat next day gives identical prior receipt',async()=>isolated(async()=>{
  const actor=extra[0].actor;const c=await completion(actor,'plumbing.book.1');
  await clock('2026-12-06T20:59:59Z');const first=await award(c);assert.equal(first.earned_on,'2026-12-06');assert.equal(first.week_start,'2026-11-30');
  await clock('2026-12-06T21:00:00Z');assert.deepEqual(await award(c),first);const second=await earn(actor,'plumbing.book.2');assert.equal(second.earned_on,'2026-12-07');assert.equal(second.week_start,'2026-12-07');
  const reserved=await scalar('select reserved_on from private.xp_source_claims where id=$1',[c]);assert.ok(first.earned_on!==reserved||second.earned_on!==reserved); // calendar test must also work on Dec6 itself
  for(const[time,day0,week0,n]of[['2026-12-06T20:59:59Z','2026-12-06','2026-11-30',7],['2026-12-06T21:00:00Z','2026-12-07','2026-12-07',1],['2026-12-07T21:00:00Z','2026-12-08','2026-12-07',2]]){
   const p=(await db.query('select * from private.xp_periods($1)',[time])).rows[0];assert.equal(p.day,day0);assert.equal(p.week_start,week0);assert.equal(p.unlocked,n);
  }
 }));
 await check('daily2, weekly7 and elapsed-day rights work together; Monday absence allows Tuesday2, failures never consume',async()=>isolated(async()=>{
  const actor=extra[0].actor;await clock('2026-12-07T09:00:00Z');await earn(actor,'business.practice.1');const second=await completion(actor,'business.practice.2');await rejects(()=>award(second));
  await clock('2026-12-08T09:00:00Z');await award(second);await rejects(()=>earn(actor,'business.practice.3'));
  for(let d=9;d<=13;d++){await clock(day(d));await earn(actor,'business.practice.'+(d-6));}
  assert.equal(await scalar("select count(*)::int from private.xp_award_receipts where actor_id=$1 and activity_kind='practice'",[actor]),7);
  await rejects(()=>earn(actor,'business.practice.8'));
  const other=extra[1].actor;await clock('2026-12-08T09:00:00Z');await earn(other,'business.practice.1');await earn(other,'business.practice.2');await rejects(()=>earn(other,'business.practice.3'));
  assert.equal(await scalar("select count(*)::int from private.xp_award_receipts where actor_id=$1",[other]),2);
 }));
 await check('fresh week and skill rights do not transfer failed sources or mint activity; no-login consumption',async()=>isolated(async()=>{
  const actor=extra[0].actor;await clock('2026-12-13T09:00:00Z');await earn(actor,'plumbing.practice.1');
  await clock('2026-12-14T09:00:00Z');await earn(actor,'plumbing.practice.2');await rejects(()=>earn(actor,'plumbing.practice.3'));
  await earn(actor,'business.practice.1'); // separate skill, same general daily XP cap still applies
  assert.equal(await scalar('select count(*)::int from private.xp_award_receipts where actor_id=$1',[actor]),3);
 }));
 await check('failed transaction after receipt insertion leaves no claim, proof, receipt, practice right or canonical change',async()=>{
  const actor=extra[0].actor,definition='business.practice.1';const expectedSource=await scalar("select private.xp_completion_source_id($1,$2,'practice')",[actor,definition]);
  await clock(day(8));const receipts=await scalar('select count(*)::int from private.xp_award_receipts');
  await rejects(()=>tx(async c=>{
   await c.query("create function pg_temp.xp_fail()returns trigger language plpgsql as $$begin raise exception using errcode='23514',message='fixture fault after award';end$$");
   await c.query('create trigger zz_xp_fixture_failure after insert on private.xp_award_receipts for each row execute function pg_temp.xp_fail()');
   await earn(actor,definition,c);
  }));
  assert.equal(await scalar('select count(*)::int from private.xp_source_claims where source_id=$1',[expectedSource]),0);
  assert.equal(await scalar('select count(*)::int from private.xp_award_receipts'),receipts);assert.deepEqual(await state(actor,'business'),{level:0,xp:'0'});
  await isolated(async()=>{await earn(actor,definition);assert.deepEqual(await state(actor,'business'),{level:0,xp:'18'});});
 });
 await check('proof binding rejects other actor/skill, duplicate orientation, forged reference/hash and deleted/revoked source',async()=>isolated(async()=>{
  const actor=extra[0].actor;await clock(day(8));const claim=await completion(actor,'business.book.1');
  await rejects(()=>db.query('select private.record_test_xp_completion($1,$2,$3,$4)',[actor,'business.book.1',uuid(),Buffer.alloc(32,2)]));
  await rejects(()=>db.query(`insert into private.xp_verified_completions(claim_id,actor_id,skill_code,definition_code,activity_kind,verification_ref,evidence_hash) values($1,$2,'plumbing','plumbing.book.1','book',$3,$4)`,[claim,extra[1].actor,uuid(),Buffer.alloc(32,1)]));
  await db.query("insert into private.xp_completion_revocations(claim_id,reason)values($1,'Disposable invalid evidence')",[claim]);await rejects(()=>award(claim));
  await earn(actor,'business.orientation');await rejects(()=>completion(actor,'plumbing.orientation'),['23514','23505']);
 }));
 await check('two concurrent sessions replay one source and immutable receipt exactly once',async()=>{
  await clock(day(8));const actor=extra[0].actor;const claim=await completion(actor,'plumbing.book.1');
  const results=await Promise.all([tx(c=>award(claim,c)),tx(c=>award(claim,c))]);assert.deepEqual(results[0],results[1]);assert.deepEqual(await state(actor,'plumbing'),{level:0,xp:'8'});
 });
 await check('parallel different skills cannot bypass110 general daily cap',async()=>{
  await clock(day(8));const actor=extra[1].actor;
  for(const skill of['plumbing','business','basic_teaching'])await earn(actor,modules.find(m=>m.skill===skill).code);
  const ids=await Promise.all(['plumbing.book.1','business.book.1'].map(code=>completion(actor,code)));
  const results=await Promise.allSettled(ids.map(id=>tx(c=>award(id,c))));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  for(const r of results.filter(r=>r.status==='rejected'))assert.equal(r.reason.code,'23514');
  assert.equal(await scalar('select sum(awarded_xp)::int from private.xp_award_receipts where actor_id=$1',[actor]),104);
 });
 await check('parallel same-skill claims cannot bypass70 skill daily cap',async()=>{
  await clock(day(8));await earn(actorB,modules.find(m=>m.skill==='business'&&m.ordinal===1).code);
  const second=modules.find(m=>m.skill==='business'&&m.ordinal===2).code;
  const ids=[await completion(actorB,second),await completion(actorB,'business.book.1')];
  const results=await Promise.allSettled(ids.map(id=>tx(c=>award(id,c))));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const used=await scalar("select sum(awarded_xp)::int from private.xp_award_receipts where actor_id=$1 and skill_code='business'",[actorB]);assert.ok(used<=70);
 });
 await check('parallel practice claims consume only two Tuesday catch-up rights',async()=>{
  await clock(day(8));const actor=extra[2].actor;const ids=[];for(let i=1;i<=3;i++)ids.push(await completion(actor,'business.practice.'+i));
  const results=await Promise.allSettled(ids.map(id=>tx(c=>award(id,c))));assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
  assert.deepEqual(await state(actor,'business'),{level:1,xp:'36'});
 });
 const waitOn=async(pid)=>{for(let i=0;i<100;i++){if(await scalar("select wait_event_type='Lock'from pg_stat_activity where pid=$1",[pid]))return;await new Promise(r=>setTimeout(r,20));}assert.fail('worker did not wait on serialization lock');};
 async function raceBeforeAward(claim,mutate,expected){
  const locker=new pg.Client({connectionString:url.href}),worker=new pg.Client({connectionString:url.href});await locker.connect();await worker.connect();let pending;
  try{
   await locker.query('begin');await mutate(locker);
   const pid=await scalar('select pg_backend_pid()',[],worker);
   pending=award(claim,worker).then(r=>({ok:true,result:r}),e=>({ok:false,code:e.code}));
   await waitOn(pid);await locker.query('commit');const result=await pending;
   if(expected===true){assert.equal(result.ok,true);return result.result;}else assert.deepEqual(result,{ok:false,code:expected});
  }finally{await locker.query('rollback');if(pending)await pending;await locker.end();await worker.end();}
 }
 await check('runtime deactivation wins before waiting award; no partial receipt/XP',async()=>{
  await clock(day(8));const actor=extra[3].actor,claim=await completion(actor,'business.book.1');
  await raceBeforeAward(claim,c=>c.query("update private.xp_runtime set mode='disabled'"),'42501');
  assert.deepEqual(await state(actor,'business'),{level:0,xp:'0'});await db.query("update private.xp_runtime set mode='disposable_only'");
 });
 await check('waiting reward observes committed policy version; source replay still returns old version',async()=>{
  await db.query("insert into private.xp_policies select policy_id,2,thresholds,rewards,general_daily,skill_daily,practice_daily,practice_weekly,'Disposable version2 same approved numbers',created_at from private.xp_policies where version=1");
  const actor=extra[3].actor,claim=await completion(actor,'business.book.1');
  const r=await raceBeforeAward(claim,c=>c.query('update private.xp_runtime set policy_version=2'),true);assert.equal(r.policy_version,2);
  await db.query('update private.xp_runtime set policy_version=1');assert.deepEqual(await award(claim),r);
 });
 await check('concurrent source revocation rejects waiting award and leaves canonical XP unchanged',async()=>{
  const actor=extra[4].actor,claim=await completion(actor,'business.book.1');
  await raceBeforeAward(claim,c=>c.query("insert into private.xp_completion_revocations(claim_id,reason)values($1,'Disposable race revoke')",[claim]),'23514');
  assert.deepEqual(await state(actor,'business'),{level:0,xp:'0'});
 });
 await check('concurrent committed ban blocks existing session/owner call; unban allows safe retry, mute remains chat-only',async()=>{
  const {actor,u}=extra[5];const claim=await completion(actor,'business.book.1');
  await raceBeforeAward(claim,async c=>{
   await c.query('select 1 from public.buildings where id=$1 for update',[building]);
   await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[staff,JSON.stringify({sub:staff,aal:'aal2'})]);
   await c.query("select public.staff_sanction($1,'ban',null,$2,'Disposable XP ban race')",[u,uuid()]);
  },'42501');
  assert.deepEqual(await state(actor,'business'),{level:0,xp:'0'});
  await as(staff,"select public.staff_sanction($1,'unban',null,$2,'Disposable XP unban')",[u,uuid()]);
  await as(staff,"select public.staff_sanction($1,'mute',null,$2,'Disposable XP mute')",[u,uuid()]);await award(claim);
  await as(staff,"select public.staff_sanction($1,'unmute',null,$2,'Disposable XP unmute')",[u,uuid()]);
 });
 await check('missing membership/account and unsafe isolation fail closed; actor-less legacy access still works',async()=>{
  await isolated(async()=>{await db.query('delete from public.memberships where user_id=$1',[extra[6].u]);await rejects(()=>completion(extra[6].actor,'business.book.1'),['42501']);});
  await rejects(()=>db.query('delete from auth.users where id=$1',[a]),['23503']);
  await rejects(()=>tx(c=>award(draftClaim,c),'repeatable read'),['25001']);
  assert.equal((await as(actorless,'select public.my_actor()')).rows[0].my_actor,null);
  assert.ok((await as(actorless,'select * from public.messages')).rowCount>0);
 });
 await check('accidental EXECUTE grants or JWT flags cannot lend DB owner authority',async()=>{
  await assert.rejects(()=>tx(async c=>{
   await c.query('grant usage on schema private to service_role');await c.query('grant execute on all functions in schema private to service_role');
   await c.query('set local role service_role');await c.query('select private.award_verified_xp($1)',[draftClaim]);
  }),e=>{assert.equal(e.code,'42501');assert.match(e.message,/veritabanı sahibine/);return true;});
 });
 await check('exact110 general and70 skill boundaries admit full reward, then refuse without partial XP',async()=>isolated(async()=>{
  await clock(day(8));const actor=extra[7].actor;
  for(const code of[modules[0].code,'business.course.1','basic_teaching.practice.1','advanced_teaching.orientation','basic_teaching.course.1'])await earn(actor,code);
  assert.equal(await scalar('select sum(awarded_xp)::int from private.xp_award_receipts where actor_id=$1',[actor]),110);
  const claim=await completion(actor,'advanced_teaching.book.1');await rejects(()=>award(claim));
  assert.equal(await scalar('select count(*)::int from private.xp_award_receipts where claim_id=$1',[claim]),0);
  const other=extra[8].actor;
  for(const code of['plumbing.orientation',modules[0].code,'plumbing.practice.1','plumbing.book.1'])await earn(other,code);
  assert.deepEqual(await state(other,'plumbing'),{level:2,xp:'70'});await rejects(()=>earn(other,'plumbing.book.2'));
 }));
 await check('player initialization after new guards stays0/0; independent consistency guard rejects injected player/NPC corruption',async()=>{
  await isolated(async()=>{
   const id=await scalar('select private.ensure_player_actor($1)',[actorless]);
   assert.equal(await scalar('select count(*)::int from private.actor_skills where actor_id=$1 and level=0 and xp=0',[id]),4);
   await rejects(()=>db.query("insert into private.actor_skills values($1,'plumbing',1,20)",[id]));
  });
  await isolated(async()=>{
   await db.query('alter table private.actor_skills disable trigger a1_fixed_row');
   await db.query("update private.actor_skills set xp=139 where actor_id=$1 and skill='plumbing'",[actorA]);
   await rejects(()=>db.query('select private.a1_assert_actor($1)',[actorA]));
  });
  await isolated(async()=>{
   await db.query('alter table private.actor_skills disable trigger a1_fixed_row');
   await db.query('update private.actor_skills set xp=1 where actor_id=$1',[bot]);
   await rejects(()=>db.query('select private.a1_assert_actor($1)',[bot]));
  });
 });
 await check('new receipt ignores forged XP, actor/skill, policy, date and level fields even for owner test insert',async()=>isolated(async()=>{
  await clock(day(9));const actor=extra[8].actor,claim=await completion(actor,'business.book.1');
  const r=(await db.query(`insert into private.xp_award_receipts(claim_id,actor_id,skill_code,verification_ref,evidence_hash,policy_id,policy_version,activity_kind,definition_code,awarded_xp,previous_xp,next_xp,previous_level,next_level,starter_count,earned_at,earned_on,week_start)
   values($1,$2,'plumbing',$3,$4,'fake',999,'practice','fake',999,0,999,0,10,0,'1970-01-01','1970-01-01','1970-01-01')returning *`,[claim,actorA,uuid(),Buffer.alloc(32,3)])).rows[0];
  assert.equal(r.actor_id,actor);assert.equal(r.skill_code,'business');assert.equal(r.awarded_xp,8);assert.equal(r.next_level,0);assert.equal(r.earned_on,'2026-12-09');assert.equal(r.policy_version,1);
 }));
 await check('award samples server date only after a contended runtime fence across Turkey midnight',async()=>{
  const actor=extra[6].actor;await clock('2026-12-06T20:59:59Z');const claim=await completion(actor,'business.book.1');
  const r=await raceBeforeAward(claim,async c=>{await c.query('select * from private.xp_runtime for update');await clock('2026-12-06T21:00:00Z',c);},true);
  assert.equal(r.earned_on,'2026-12-07');assert.equal(r.week_start,'2026-12-07');
 });
 await check('owner cannot activate same migration in a non-disposable database name',async()=>{
  const otherName='apartman_a22b_closed';await admin.query('create database '+otherName);const otherUrl=new URL(base);otherUrl.pathname='/'+otherName;
  const c=new pg.Client({connectionString:otherUrl.href});await c.connect();
  try{
   // Thin security fixture for the identical runtime/gate functions; no hosted connection.
   await c.query(`create schema private;create table private.xp_policies(policy_id text,version int);
    create table private.xp_runtime(singleton boolean primary key,policy_id text,policy_version int,mode text);
    insert into private.xp_runtime values(true,'fixture',1,'disabled');
    create function private.a2_owner_check()returns void language plpgsql as $$begin if current_user<>'postgres' then raise exception using errcode='42501';end if;end$$;`);
   for(const name of['xp_lock_runtime','xp_require_disposable','xp_runtime_guard'])await c.query(await scalar('select pg_get_functiondef($1::regprocedure)',['private.'+name+'()']));
   await c.query('create trigger xp_runtime_change before update on private.xp_runtime for each row execute function private.xp_runtime_guard()');
   await rejects(()=>c.query("update private.xp_runtime set mode='disposable_only'"),['42501']);
   // Even if the mutation guard were accidentally absent, the award gate rejects a non-test DB.
   await c.query('alter table private.xp_runtime disable trigger xp_runtime_change');await c.query("update private.xp_runtime set mode='disposable_only'");
   await rejects(()=>c.query('select private.xp_require_disposable()'),['42501']);
  }finally{await c.end();await admin.query('drop database '+otherName+' with(force)');}
 });
 await check('all non-actor game ledgers, votes, dues, chat, NPC identities and staff grants stay byte/hash identical',async()=>{
  // Sanction tests intentionally append local moderation audit rows; no other old state may change.
  const omit=['actor_skills','xp_source_claims','staff_requests','staff_audit','player_sanctions','player_disciplinary_events'];
  const stable=tables.filter(t=>!omit.includes(t.tablename));
  const now=await hashes(stable);const old=Object.fromEntries(stable.map(t=>[t.schemaname+'.'+t.tablename,before[t.schemaname+'.'+t.tablename]]));
  assert.deepEqual(now,old);
  assert.equal(await scalar('select private.reserve_xp_source(\'fixture_training\',$1,$2,\'plumbing\',\'Korunan kaynak\')',[oldSource,actorA]),oldClaim);
  const draft=(await db.query('select * from private.learning_evidence_drafts where claim_id=$1',[draftClaim])).rows[0];assert.equal(draft.status,'draft_pass');
  assert.equal(await scalar('select count(*)::int from private.xp_award_receipts where claim_id=$1',[draftClaim]),0);
 });
 await db.query("create or replace function private.xp_server_now()returns timestamptz language sql volatile security invoker set search_path=''as $$select clock_timestamp()$$");
 console.log(`${count} A2-2b XP PostgreSQL groups passed. Synthetic disposable adapter only; production disabled; real Auth/MFA/Realtime not tested.`);
}finally{await db.end();await admin.query('drop database apartman_a22b_xp with(force)');await admin.end();}
