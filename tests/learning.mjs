// Disposable PostgreSQL ONLY. No hosted URL/config, real actors or content seed.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
const {modules}=JSON.parse(await readFile('tests/fixtures/learning/starter-modules.json','utf8'));
const js=ts.transpileModule(await readFile('src/domain/learning/index.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {evaluateLearningDraft}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const base='postgresql://postgres:local-test-only@127.0.0.1:55432/postgres';
const url=new URL(base);url.pathname='/apartman_a22a_learning';
const admin=new pg.Client({connectionString:base}),db=new pg.Client({connectionString:url.href});
const uuid=()=>crypto.randomUUID(),quote=s=>'"'+s.replaceAll('"','""')+'"';
const scalar=async(sql,args=[],c=db)=>Object.values((await c.query(sql,args)).rows[0])[0];
let count=0;
const check=async(name,fn)=>{await fn();count++;console.log('PASS',name);};
const rejects=(fn,codes=['23514'])=>assert.rejects(fn,e=>{assert.ok(codes.includes(e.code),e.code+': '+e.message);return true;});
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
function wrong(m){const a=structuredClone(m.expectedAnswer);if(m.assessmentKind==='selection')a.choice='wrong';if(m.assessmentKind==='ordering')a.steps.reverse();if(m.assessmentKind==='matching')a.pairs[Object.keys(a.pairs)[0]]='wrong';return a;}
await admin.connect();await admin.query('create database apartman_a22a_learning');await db.connect();
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
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();assert.equal(files.length,13);assert.match(files[12],/_a22a_passive_learning_foundation\.sql$/);
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
 const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in('public','private','auth','cron')order by 1,2")).rows;
 const before=await hashes(tables),schemaBefore=await oldSchema();
 const migration=await readFile('supabase/migrations/'+files[12],'utf8');
 await check('additive migration preserves every existing row/hash, old function/trigger/ACL/RLS and cron/realtime definition',async()=>{
  await db.query('begin');await db.query(migration);await db.query('rollback');
  assert.equal(await scalar("select to_regclass('private.learning_modules')"),null);
  assert.deepEqual(await hashes(tables),before);
  await db.query('begin');await db.query(migration);await db.query('commit');
  assert.deepEqual(await hashes(tables),before);
  const schema=await oldSchema();for(const entry of schemaBefore)assert.deepEqual(schema.find(e=>e.kind===entry.kind&&e.key===entry.key),entry);
  for(const t of['learning_modules','learning_module_drafts','learning_evidence_drafts'])assert.equal(await scalar('select count(*)::int from private.'+t),0);
 });
 await check('all new tables/functions are closed to anon, authenticated, service_role and staff; no public RPC exists',async()=>{
  const funcs=(await db.query("select p.oid::regprocedure::text signature,p.prosecdef definer,p.proconfig config from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and(proname like 'a22_%'or proname in('learning_source_id','stage_learning_evidence_draft'))")).rows;
  for(const f of funcs){assert.equal(f.definer,false);assert.ok(f.config.some(v=>v.startsWith('search_path=')&&v.slice(12).replaceAll('"','')===''));}
  for(const role of['anon','authenticated','service_role']){
   for(const{signature}of funcs)assert.equal(await scalar('select has_function_privilege($1,$2,\'EXECUTE\')',[role,signature]),false);
   for(const t of['learning_modules','learning_module_drafts','learning_evidence_drafts']){
    assert.equal(await scalar("select relrowsecurity from pg_class where oid=$1::regclass",['private.'+t]),true);
    for(const permission of['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'private.'+t,permission]),false);
   }
   await rejects(()=>as(staff,'select private.stage_learning_evidence_draft($1,$2,1,$3)',[actorA,modules[0].code,modules[0].expectedAnswer],role),['42501']);
  }
  assert.equal(await scalar("select to_regprocedure('public.stage_learning_evidence_draft(uuid,text,integer,jsonb)')"),null);
  assert.equal(await scalar("select count(*)::int from pg_policies where tablename like 'learning_%'"),0);
 });
 await check('12 owner-only test drafts form four zero-entry, finite ordered paths; missing/cross-field/renamed prerequisites fail',async()=>{
  await rejects(()=>loadDraft(modules[1]));
  for(const m of modules)await loadDraft(m);
  assert.equal(await scalar('select count(*)::int from private.learning_modules'),12);
  await rejects(()=>db.query('insert into private.learning_modules values($1,$2,2,$3,now())',['plumbing.starter.renamed','plumbing',modules[0].code]),['23505']);
  await rejects(()=>db.query('insert into private.learning_modules values($1,$2,4,$3,now())',['plumbing.starter.fourth','plumbing',modules[2].code]));
  await rejects(()=>draftVersion({...modules[0],version:2,expectedAnswer:{completed:true}}));
  await rejects(()=>db.query("update private.learning_module_drafts set activation='active'"));
 });
 await check('PostgreSQL independently grades all12 tasks and agrees with the pure TypeScript validator',async()=>{
  for(const m of modules)for(const answer of[m.expectedAnswer,wrong(m),null,{},true,{completed:true},{...m.expectedAnswer,completed:true},{choice:12},{steps:['x','x']},{pairs:[]}]){
   assert.equal(await scalar('select private.a22_answer_matches($1,$2,$3)',[m.assessmentKind,m.expectedAnswer,answer]),evaluateLearningDraft(m,answer).status==='draft_pass');
  }
 });
 await check('failed/invalid proof and skipped prerequisite create no claim or draft success; actor-less/nonresident/bot targets rejected',async()=>{
  const claims=await scalar('select count(*)::int from private.xp_source_claims');
  for(const answer of[wrong(modules[0]),{completed:true},null])await rejects(()=>stage(actorA,modules[0],answer));
  await rejects(()=>stage(actorA,modules[1]));
  for(const id of[uuid(),bot])await rejects(()=>stage(id,modules[0]),['42501']);
  assert.equal(await scalar('select count(*)::int from private.xp_source_claims'),claims);
  assert.equal(await scalar('select count(*)::int from private.learning_evidence_drafts'),0);
 });
 await check('all four paths can be staged sequentially at0/0; no XP, teacher qualification, wallet or actor mutation occurs',async()=>{
  const unchanged=tables.filter(t=>t.tablename!=='xp_source_claims');const snapshot=await hashes(unchanged);
  for(const m of modules)await stage(actorA,m);
  assert.equal(await scalar('select count(*)::int from private.learning_evidence_drafts'),12);
  assert.equal(await scalar("select bool_and(octet_length(evidence_hash)=32 and evidence_hash<>decode(repeat('00',32),'hex')and evaluated_at>clock_timestamp()-interval '5 minutes')from private.learning_evidence_drafts"),true);
  assert.equal(await scalar("select bool_and(reserved_on=(reserved_at at time zone 'Europe/Istanbul')::date)from private.xp_source_claims"),true);
  assert.equal(await scalar('select count(*)::int from private.actor_skills where actor_id=$1 and(level<>0 or xp<>0)',[actorA]),0);
  assert.deepEqual(await hashes(unchanged),snapshot);
 });
 await check('repeat/devices/sessions use one deterministic source; matching key order does not rewrite evidence/time/hash',async()=>{
  const m=modules[0],one=await stage(actorA,m);const before=(await db.query('select * from private.learning_evidence_drafts where claim_id=$1',[one])).rows[0];
  const claims=await scalar('select count(*)::int from private.xp_source_claims');
  const again=await tx(c=>stage(actorA,m,m.expectedAnswer,c));assert.equal(again,one);
  assert.deepEqual((await db.query('select * from private.learning_evidence_drafts where claim_id=$1',[one])).rows[0],before);
  assert.equal(await scalar('select count(*)::int from private.xp_source_claims'),claims);
  const match=modules.find(m=>m.assessmentKind==='matching');const answer={pairs:Object.fromEntries(Object.entries(match.expectedAnswer.pairs).reverse())};assert.equal(await stage(actorA,match,answer),await stage(actorA,match));
 });
 await check('content version/rename changes never reset the logical completion source or grant a second proof',async()=>{
  const m=modules[0];await draftVersion({...m,version:2,titleTr:m.titleTr+' revizyon'});
  const countBefore=await scalar('select count(*)::int from private.xp_source_claims');
  await rejects(()=>stage(actorA,m,m.expectedAnswer,db,2));
  assert.equal(await sourceId(actorA,m),await scalar('select private.learning_source_id($1,$2)',[actorA,m.code]));
  assert.equal(await scalar('select count(*)::int from private.xp_source_claims'),countBefore);
 });
 await check('two concurrent trusted requests create one source and one draft evidence record',async()=>{
  const m=modules[0];const ids=await Promise.all([tx(c=>stage(actorB,m,m.expectedAnswer,c)),tx(c=>stage(actorB,m,m.expectedAnswer,c))]);assert.equal(ids[0],ids[1]);
  assert.equal(await scalar('select count(*)::int from private.xp_source_claims where source_id=$1',[await sourceId(actorB,m)]),1);
  assert.equal(await scalar('select count(*)::int from private.learning_evidence_drafts where actor_id=$1 and module_code=$2',[actorB,m.code]),1);
 });
 await check('source cannot move to another actor/skill/module; random duplicate source UUID cannot become eligible evidence',async()=>{
  const m=modules[0],claim=await stage(actorA,m);
  const insert=(c,actor,module,skill)=>c.query(`insert into private.learning_evidence_drafts(claim_id,actor_id,module_code,skill_code,content_version,answers,feedback_tr,evidence_hash)values($1,$2,$3,$4,1,$5,'fake',decode(repeat('00',32),'hex'))`,[claim,actor,module,skill,m.expectedAnswer]);
  await rejects(()=>insert(db,actorB,m.code,m.skill));
  await rejects(()=>insert(db,actorA,m.code,'business'));
  const next=modules[1];await rejects(()=>db.query(`insert into private.learning_evidence_drafts(claim_id,actor_id,module_code,skill_code,content_version,answers,feedback_tr,evidence_hash)values($1,$2,$3,$4,1,$5,'fake',decode(repeat('00',32),'hex'))`,[claim,actorA,next.code,next.skill,next.expectedAnswer]));
  const wrongClaim=await scalar("select private.reserve_xp_source('starter_learning',$1,$2,$3,$4)",[uuid(),actorB,m.skill,'starter module:'+m.code]);
  await rejects(()=>db.query(`insert into private.learning_evidence_drafts(claim_id,actor_id,module_code,skill_code,content_version,answers,feedback_tr,evidence_hash)values($1,$2,$3,$4,1,$5,'fake',decode(repeat('00',32),'hex'))`,[wrongClaim,actorB,m.code,m.skill,m.expectedAnswer]));
 });
 await check('failure after source reservation rolls back source/evidence together and safe retry works',async()=>{
  const m=modules[1],id=await sourceId(actorB,m);
  await rejects(()=>tx(async c=>{
   await c.query("create function pg_temp.fixture_reject()returns trigger language plpgsql as $$begin raise exception using errcode='23514',message='fixture failure';end$$");
   await c.query('create trigger fixture_fail after insert on private.learning_evidence_drafts for each row execute function pg_temp.fixture_reject()');
   await stage(actorB,m,m.expectedAnswer,c);
  }));
  assert.equal(await scalar('select count(*)::int from private.xp_source_claims where source_id=$1',[id]),0);
  assert.equal(await scalar('select count(*)::int from private.learning_evidence_drafts where actor_id=$1 and module_code=$2',[actorB,m.code]),0);
  await stage(actorB,m);
 });
 await check('immutable rows, no truncate,0/0 player guard and fixed bot profiles all remain enforced',async()=>{
  const m=modules[2],source=await sourceId(actorB,m);
  const claim=await scalar("select private.reserve_xp_source('starter_learning',$1,$2,$3,$4)",[source,actorB,m.skill,'starter module:'+m.code]);
  const record=await tx(async c=>{
   await c.query("set local time zone 'Pacific/Honolulu'");
   return(await c.query(`insert into private.learning_evidence_drafts(claim_id,actor_id,module_code,skill_code,content_version,answers,feedback_tr,evidence_hash,evaluated_at)values($1,$2,$3,$4,1,$5,'forged feedback',decode(repeat('00',32),'hex'),'1970-01-01')returning *`,[claim,actorB,m.code,m.skill,m.expectedAnswer])).rows[0];
  });
  assert.equal(record.feedback_tr,m.successFeedbackTr);assert.ok(record.evaluated_at.getTime()>Date.now()-300000);
  const digest=await scalar(`select sha256(convert_to(jsonb_build_object('claim',c.id,'source',c.source_id,'actor',c.actor_id,'skill',e.skill_code,'module',e.module_code,'version',d.version,'definition',to_jsonb(d)-'created_at','answer',e.answers)::text,'UTF8'))from private.learning_evidence_drafts e join private.xp_source_claims c on c.id=e.claim_id join private.learning_module_drafts d on d.module_code=e.module_code and d.version=e.content_version where e.claim_id=$1`,[claim]);
  assert.deepEqual(record.evidence_hash,digest);
  for(const t of['learning_modules','learning_module_drafts','learning_evidence_drafts']){
   await rejects(()=>db.query('delete from private.'+t));await rejects(()=>db.query('truncate private.'+t+' cascade'));
  }
  await rejects(()=>db.query('update private.actor_skills set level=1,xp=1 where actor_id=$1',[actorA]));
  await rejects(()=>db.query('update private.actor_skills set level=10,xp=100 where actor_id=$1',[bot]));
  await rejects(()=>as(a,'update private.actor_skills set xp=999 where actor_id=$1',[actorA]),['42501']);
  await db.query('select private.a1_assert_actor($1)',[actorA]);await db.query('select private.a1_assert_actor($1)',[bot]);
 });
 await check('owner boundary survives accidental function execute grants; stale RR snapshots explicitly fail closed',async()=>{
  await assert.rejects(()=>tx(async c=>{
   await c.query('grant usage on schema private to service_role');
   await c.query('grant execute on all functions in schema private to service_role');await c.query('set local role service_role');
   await c.query('select private.stage_learning_evidence_draft($1,$2,1,$3)',[actorA,modules[0].code,modules[0].expectedAnswer]);
  }),e=>{assert.equal(e.code,'42501');assert.match(e.message,/veritabanı sahibine/);return true;});
  await rejects(()=>tx(c=>stage(actorA,modules[0],modules[0].expectedAnswer,c),'repeatable read'),['25001']);
 });
 const sanction=(action)=>as(staff,'select public.staff_sanction($1,$2,null,$3,$4)',[a,action,uuid(),'Disposable öğrenme güvenlik testi']);
 await check('ban blocks already-authenticated/direct owner staging; mute does not change non-chat learning semantics',async()=>{
  await sanction('ban');await rejects(()=>stage(actorA,modules[0]),['42501']);await sanction('unban');
  await sanction('mute');assert.ok(await stage(actorA,modules[0]));await sanction('unmute');
 });
 await check('building/sanction lock serialization rechecks a concurrently committed ban before accepting evidence',async()=>{
  const lock=new pg.Client({connectionString:url.href}),worker=new pg.Client({connectionString:url.href});await lock.connect();await worker.connect();
  let pending;
  try{
   await lock.query('begin');await lock.query('select 1 from public.buildings where id=$1 for update',[building]);
   await lock.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[staff,JSON.stringify({sub:staff,aal:'aal2'})]);
   await lock.query('select public.staff_sanction($1,\'ban\',null,$2,$3)',[a,uuid(),'Fixture eşzamanlı yaptırım']);
   const pid=await scalar('select pg_backend_pid()',[],worker);
   pending=stage(actorA,modules[0],modules[0].expectedAnswer,worker).then(()=>({ok:true}),e=>({ok:false,code:e.code}));
   let waiting=false;for(let i=0;i<60;i++){waiting=await scalar("select wait_event_type='Lock'from pg_stat_activity where pid=$1",[pid]);if(waiting)break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(waiting,true);await lock.query('commit');assert.deepEqual(await pending,{ok:false,code:'42501'});
  }finally{await lock.query('rollback');if(pending)await pending;await lock.end();await worker.end();}
  await sanction('unban');
 });
 await check('leaving a building stops new draft acceptance but preserves actor/proof; no automatic deletion or backfill',async()=>{
  const evidenceBefore=await scalar('select count(*)::int from private.learning_evidence_drafts');
  await assert.rejects(()=>tx(async c=>{
   await c.query('delete from public.memberships where user_id=$1',[b]);
   await rejects(()=>stage(actorB,modules[2],modules[2].expectedAnswer,c),['42501']);throw new Error('rollback fixture departure');
  }));
  assert.equal(await scalar('select count(*)::int from private.learning_evidence_drafts'),evidenceBefore);
  await rejects(()=>db.query('delete from auth.users where id=$1',[a]),['23503']);
 });
 await check('actor-less resident keeps legacy game, old claims/skills/NPCs/economy stay intact and no policy/counter/worker is activated',async()=>{
  assert.equal((await as(actorless,'select public.my_actor()')).rows[0].my_actor,null);
  assert.ok((await as(actorless,'select * from public.messages')).rowCount>=1);
  assert.equal(await scalar("select private.reserve_xp_source('fixture_training',$1,$2,'plumbing','Korunan kaynak')",[oldSource,actorA]),oldClaim);
  for(const t of['actors','actor_skills','bot_profiles','bot_teaching_fields','npc_worlds','npc_plan_approvals','npc_homes']){
   const item=tables.find(t0=>t0.tablename===t);assert.deepEqual((await hashes([item]))['private.'+t],before['private.'+t]);
  }
  const economy=tables.filter(t=>['wallets','wallet_transactions','dues','treasury_entries','treasury_transactions','elections','election_votes','manager_terms'].includes(t.tablename));assert.deepEqual(await hashes(economy),Object.fromEntries(economy.map(t=>[t.schemaname+'.'+t.tablename,before[t.schemaname+'.'+t.tablename]])));
  assert.equal(await scalar("select count(*)::int from private.actor_skills s join private.actors a on a.id=s.actor_id where a.kind='player'and(level<>0 or xp<>0)"),0);
 });
 console.log(`${count} A2-2a passive learning PostgreSQL groups passed. Draft fixtures only, no XP, live seed or actual Auth/MFA/Realtime acceptance.`);
}finally{await db.end();await admin.query('drop database apartman_a22a_learning with(force)');await admin.end();}
