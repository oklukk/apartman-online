// Disposable synthetic records ONLY. No live manifest, connection or seed.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
const js=ts.transpileModule(await readFile('src/domain/actors/index.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validateInitialActorPlan,SKILLS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const base='postgresql://postgres:local-test-only@127.0.0.1:55432/postgres',url=new URL(base);url.pathname='/apartman_a2_npc';
const admin=new pg.Client({connectionString:base}),db=new pg.Client({connectionString:url.href});
const uuid=()=>crypto.randomUUID(),q=s=>'"'+s.replaceAll('"','""')+'"';
const scalar=async(sql,args=[],c=db)=>Object.values((await c.query(sql,args)).rows[0])[0];
let count=0,normalized=false;
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
const world=(code,limit,c=db)=>scalar('select private.register_npc_world($1,$2,$3,$4,$5)',[code,limit===2&&code==='old_pilot'?'pilot':'world',limit,'test-ref','Disposable catalog world'],c);
const approve=(w,s,c=db)=>scalar('select private.approve_npc_plan($1,$2,$3,$4)',[w,s,'test-ref','Disposable catalog approval'],c);
const provision=(a,c=db)=>scalar('select private.provision_npc_plan($1)',[a],c);
const job=(key,role,field='fixture_carpentry',home=1)=>({key,name:'Fixture '+key,building_key:'fixture_building',home_number:home,role,field,teaching_fields:role==='lecturer'?[field]:[],
 levels:role==='worker'?{[field]:3}:role==='operator'?{[field]:4,business:4}:{[field]:6,basic_teaching:5,advanced_teaching:3}});
const plan=(code,bots,required=[])=>({code,scope:'world',population_limit:bots.length,required_teaching_fields:required,buildings:[{key:code+'_building',name:'Fixture bina',capacity:4}],bots:bots.map(b=>({...b,building_key:code+'_building'}))});
function projection(s,t){return normalized&&s==='private'&&t==='bot_profiles'?"(to_jsonb(r)||jsonb_build_object('teaching_fields',to_jsonb(private.npc_teaching_codes(r.actor_id))))":'to_jsonb(r)';}
async function rows(tables){const out={};for(const{schemaname:s,tablename:t}of tables)out[s+'.'+t]=(await db.query(`select ${projection(s,t)} value from ${q(s)}.${q(t)} r order by 1`)).rows.map(r=>r.value);return out;}
async function hash(tables){const out={};for(const{schemaname:s,tablename:t}of tables)out[s+'.'+t]=(await db.query(`select count(*)::int n,md5(coalesce(string_agg((${projection(s,t)})::text,E'\n' order by (${projection(s,t)})::text),'')) hash from ${q(s)}.${q(t)} r`)).rows[0];return out;}
async function catalog(){return(await db.query(`select 'function' kind,p.oid::regprocedure::text key,jsonb_build_object('src',prosrc,'acl',proacl,'config',proconfig,'definer',prosecdef) value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth','cron')
 union all select 'policy',schemaname||'.'||tablename||'.'||policyname,to_jsonb(p) from pg_policies p
 union all select 'table',n.nspname||'.'||c.relname,jsonb_build_object('acl',relacl,'rls',relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','cron') and relkind in ('r','v')
 union all select 'trigger',tgrelid::regclass::text||'.'||tgname,to_jsonb(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal
 union all select 'publication',pubname,to_jsonb(p) from pg_publication p
 union all select 'publication_table',pubname||'.'||schemaname||'.'||tablename,to_jsonb(p) from pg_publication_tables p order by 1,2`)).rows;}
await admin.connect();await admin.query('create database apartman_a2_npc');await db.connect();
try{
 for(const r of ['anon','authenticated','service_role'])if(!(await admin.query('select 1 from pg_roles where rolname=$1',[r])).rowCount)await admin.query('create role '+r+' nologin');
 await db.query(`create schema auth;create schema extensions;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);create table auth.mfa_factors(user_id uuid references auth.users,status text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;create publication supabase_realtime;
 -- Registry stub, not actual pg_cron execution.
 create schema cron;create table cron.job(id bigint generated always as identity,jobname text unique,schedule text,command text);
 create function cron.schedule(n text,s text,c text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(n,s,c) returning id$$;`);
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();assert.equal(files.length,12);assert.match(files[11],/_a2_npc_catalog_migration\.sql$/);
 for(const f of files.slice(0,11)){await db.query('begin');await db.query((await readFile('supabase/migrations/'+f,'utf8')).replace(/create extension if not exists pg_cron with schema pg_catalog;/g,''));await db.query('commit');}
 const[a,b,staff]=[uuid(),uuid(),uuid()];for(const[i,u]of[a,b,staff].entries())await db.query('insert into auth.users values($1,$2,now())',[u,{username:'a2b_fixture_'+i}]);
 const building=await scalar("select id from public.buildings where slug='cinar'");
 await db.query("insert into private.invitations(building_id,code_hash,expires_at,uses_remaining) values($1,sha256(convert_to('a2b-fixture','UTF8')),now()+interval '1 day',12)",[building]);
 for(const u of[a,b])await as(u,"select public.join_building('a2b-fixture')");
 await as(a,"select public.player_action('job','technical')");await as(a,"select public.send_message('Korunan A2b mesajı')");
 const poll=await scalar('select id from public.polls limit 1');await as(a,'select public.cast_vote($1,true)',[poll]);await db.query('select private.run_v02()');
 const election=await scalar('select id from public.elections limit 1');await db.query("insert into public.election_candidates(election_id,user_id,building_id,statement) values($1,$2,$3,'Korunan aday')",[election,a,building]);
 await db.query('insert into public.election_votes(election_id,user_id,candidate_id,building_id) values($1,$2,$2,$3)',[election,a,building]);
 await db.query("insert into public.dues(building_id,user_id,week_start,amount) values($1,$2,date_trunc('week',now() at time zone 'Europe/Istanbul')::date,150)",[building,a]);
 await db.query("insert into public.manager_terms(building_id,user_id,starts_at,ends_at) values($1,$2,now(),now()+interval '14 days')",[building,a]);
 await db.query("insert into auth.mfa_factors values($1,'verified')",[staff]);await db.query("select private.staff_bootstrap($1,'Fixture A2b sahibi')",[staff]);
 const actor=await scalar('select private.ensure_player_actor($1)',[a]),source=uuid();const sourceReceipt=await scalar("select private.reserve_xp_source('fixture_training',$1,$2,'plumbing','Fixture source')",[source,actor]);
 const pilot=plan('old_pilot_plan',[job('old_plumber','lecturer','plumbing'),job('old_business','lecturer','business',2)],['plumbing','business']);pilot.scope='pilot';pilot.buildings[0].capacity=12;
 const wp=await world('old_pilot',2),ap=await approve(wp,pilot),rp=await provision(ap);
 const multi=job('old_multi','lecturer','business');multi.teaching_fields=['business','advanced_teaching','plumbing','basic_teaching'];multi.levels=Object.fromEntries(SKILLS.map(s=>[s,6]));
 const oldPlan=plan('old_world_plan',[multi,job('old_worker','worker','plumbing',2),job('old_operator','operator','plumbing',3)],multi.teaching_fields);
 const wg=await world('old_general',3),ag=await approve(wg,oldPlan),rg=await provision(ag);
 await db.query({name:'legacy_npc_replay',text:'select private.provision_npc_plan($1)',values:[ag]});
 const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','cron') order by 1,2")).rows;
 const before=await hash(tables),original=await rows(tables),schema=await catalog();
 const legacy=tables.filter(t=>t.schemaname!=='private'||!['actors','actor_skills','skill_catalog','npc_worlds','npc_population_plans','npc_plan_approvals','npc_plan_bindings','npc_buildings','npc_building_keys','npc_homes','bot_profiles','npc_actor_keys'].includes(t.tablename));
 const legacyBefore=await hash(legacy),enumBefore=await scalar('select to_jsonb(enum_range(null::private.actor_skill_code))');
 const migration=await readFile('supabase/migrations/'+files[11],'utf8');
 await check('migration lock timeout rolls back every DDL/copy and a retry preserves the source cohort',async()=>{
  const blocker=new pg.Client({connectionString:url.href});await blocker.connect();
  try{
   await blocker.query('begin');await blocker.query('lock table private.bot_profiles in row exclusive mode');
   await db.query('begin');await rejects(()=>db.query(migration),['55P03']);await db.query('rollback');
   assert.equal(await scalar("select to_regclass('private.bot_teaching_fields')"),null);
   assert.deepEqual(await hash(tables),before);
  }finally{await db.query('rollback');await blocker.query('rollback');await blocker.end();}
  await db.query('begin isolation level repeatable read');await rejects(()=>db.query(migration),['25001']);await db.query('rollback');
 });
 await db.query('begin');await db.query(migration);await db.query('commit');normalized=true;
 await check('migration preserves all logical old row counts/hashes, ordered teaching links, IDs, claims and budgets; only reviewed function bodies change',async()=>{
  assert.deepEqual(await hash(tables),before);
  const after=new Map((await catalog()).map(r=>[r.kind+':'+r.key,r.value]));
  const changed=new Set(['private.a1_assert_actor(uuid)','private.a1_assert_plan(uuid)','private.npc_check_spec(jsonb)','private.npc_assert_teaching_coverage(uuid,private.actor_skill_code[])','private.npc_assert_provisioned(uuid)','private.provision_npc_plan(uuid)','private.ensure_player_actor(uuid)']);
  for(const r of schema){const value=after.get(r.kind+':'+r.key);if(r.kind==='function'&&changed.has(r.key))assert.deepEqual({...value,src:r.value.src},r.value);else assert.deepEqual(value,r.value,r.key);}
  assert.equal(await scalar("select count(*)::int from pg_attribute where attrelid='private.bot_profiles'::regclass and attname='teaching_fields' and not attisdropped"),0);
  assert.equal(await scalar("select format_type(atttypid,atttypmod) from pg_attribute where attrelid='private.bot_profiles'::regclass and attname='field'"),'text');
  assert.deepEqual(await scalar('select to_jsonb(private.npc_teaching_codes($1))',[rg.bots.old_multi]),multi.teaching_fields);
  assert.equal(await scalar('select count(*)::int from private.bot_teaching_fields'),6);
 });
 await check('legacy enum wrapper and new TEXT coverage, prepared replay, unsorted manifests and idempotent results remain compatible',async()=>{
  assert.deepEqual((await db.query({name:'legacy_npc_replay',text:'select private.provision_npc_plan($1)',values:[ag]})).rows[0].provision_npc_plan,rg);
  assert.deepEqual(await provision(ap),rp);assert.deepEqual(await provision(ag),rg);
  await db.query('select private.npc_assert_teaching_coverage($1,$2::private.actor_skill_code[])',[rp.plan_id,['plumbing','business']]);
  await db.query('select private.npc_assert_teaching_coverage_text($1,$2::text[])',[rg.plan_id,multi.teaching_fields]);
  assert.deepEqual(await hash(tables),before);
  assert.equal(await scalar("select private.reserve_xp_source('fixture_training',$1,$2,'plumbing','Fixture source')",[source,actor]),sourceReceipt);
 });
 await check('only the legacy wrapper retains skill-enum dependency; new catalogs and normalized relationships are genuine TEXT/FK',async()=>{
  assert.equal(await scalar("select count(*)::int from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and not a.attisdropped and a.atttypid in ('private.actor_skill_code'::regtype,(select typarray from pg_type where oid='private.actor_skill_code'::regtype))"),0);
  const deps=(await db.query("select p.oid::regprocedure::text name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and ('private.actor_skill_code[]'::regtype::oid=any(p.proargtypes::oid[]))")).rows;
  assert.deepEqual(deps.map(x=>x.name),['private.npc_assert_teaching_coverage(uuid,private.actor_skill_code[])']);
  assert.equal(await scalar("select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.prosrc like '%actor_skill_code%'"),0);
  assert.equal(await scalar("select count(*)::int from pg_constraint where conrelid='private.bot_teaching_fields'::regclass and contype='f'"),3);
 });
 await check('fifth catalog profession alone creates no NPC, and nonteachable active fields admit only worker/operator approvals',async()=>{
  await db.query("select private.define_skill('fixture_carpentry','Fixture meslek','Yalnız disposable alan',true,false)");
  assert.deepEqual(await scalar('select to_jsonb(enum_range(null::private.actor_skill_code))'),enumBefore);
  const withoutCatalog=tables.filter(t=>t.tablename!=='skill_catalog');const oldHash=Object.fromEntries(Object.entries(before).filter(([k])=>k!=='private.skill_catalog'));
  assert.deepEqual(await hash(withoutCatalog),oldHash);
  const w=await world('new_profession',3);const s=plan('new_jobs',[job('new_worker','worker'),job('new_operator','operator','fixture_carpentry',2)]);
  const p=await approve(w,s),r=await provision(p);assert.equal(Object.keys(r.bots).length,2);
  const teach=plan('new_teacher',[job('new_teacher','lecturer')],['fixture_carpentry']);await rejects(()=>approve(w,teach));
  const bad=structuredClone(s);bad.code='bad_field';bad.bots[0].field='unknown_code';bad.bots[0].levels={unknown_code:3};await rejects(()=>approve(w,bad));
  await db.query("update private.skill_catalog set is_teachable=true where code='fixture_carpentry'");
  const t=await approve(w,teach),teacher=await provision(t);await db.query('select private.npc_assert_teaching_coverage_text($1,$2::text[])',[teacher.plan_id,['fixture_carpentry']]);
  await rejects(()=>db.query('select private.npc_assert_teaching_coverage_text($1,$2::text[])',[r.plan_id,['fixture_carpentry']]));
  const codes=(await db.query('select code from private.skill_catalog order by code')).rows.map(x=>x.code);
  const profiles=(await db.query('select b.*,h.number from private.bot_profiles b join private.npc_homes h on h.id=b.home_id where b.plan_id=$1',[teacher.plan_id])).rows;
  const np=profiles[0],levels=Object.fromEntries((await db.query('select skill,level from private.actor_skills where actor_id=$1',[np.actor_id])).rows.map(x=>[x.skill,x.level]));
  const teacherBuilding=teacher.buildings[teach.buildings[0].key];
  const input={scope:'world',populationLimit:1,residentProfileIds:[],players:[],bots:[{kind:'bot',id:np.actor_id,name:np.display_name,homeId:np.home_id,role:np.role,field:np.field,teachingFields:['fixture_carpentry'],levels}],buildings:[{kind:'npc',id:teacherBuilding.id,capacity:4}],homes:Object.entries(teacherBuilding.homes).map(([number,id])=>({id,buildingId:teacherBuilding.id,number:Number(number)})),activeTeachingFields:['fixture_carpentry'],zeroLevelLearningPaths:[{field:'fixture_carpentry',entryLevel:0}],assignments:[]};
  assert.equal(validateInitialActorPlan(input,codes).ok,true);assert.equal(validateInitialActorPlan(input).ok,false);
  const cloned=await approve(w,plan('clone_worker',[job('new_worker','worker')]));await rejects(()=>provision(cloned),['23505']);
  await rejects(()=>db.query("select private.reserve_xp_source('fixture_training',$1,$2,'fixture_carpentry','Bot XP attempt')",[uuid(),teacher.bots.new_teacher]),['23503']);
  const excess=await approve(w,plan('over_budget',[job('over_budget','worker')]));await rejects(()=>provision(excess));
 });
 await check('multi-field fifth-code teaching preserves declared order, pedagogy6 priority, stable profile and approval semantics',async()=>{
  const w=await world('new_multi',1),bot=job('new_multi','lecturer');bot.teaching_fields=['fixture_carpentry','advanced_teaching','business','basic_teaching'];bot.levels=Object.fromEntries(bot.teaching_fields.map(s=>[s,6]));
  const s=plan('new_multi',[bot],bot.teaching_fields),approval=await approve(w,s),r=await provision(approval);
  assert.deepEqual(await scalar('select to_jsonb(private.npc_teaching_codes($1))',[r.bots.new_multi]),bot.teaching_fields);
  await db.query('select private.npc_assert_teaching_coverage_text($1,$2::text[])',[r.plan_id,bot.teaching_fields]);
  const reversed=structuredClone(s);reversed.bots[0].teaching_fields.reverse();await rejects(()=>approve(w,reversed));
  const marker=new Error('rollback metadata fixture');
  await assert.rejects(()=>tx(async client=>{
   await client.query("update private.skill_catalog set is_active=false,is_teachable=false where code='business'");
   assert.deepEqual(await provision(ag,client),rg);
   const wrong=structuredClone(oldPlan);wrong.code='disabled_field';await rejects(()=>approve(wg,wrong,client));throw marker;
  }),e=>e===marker);
 });
 await check('normalized teaching rows cannot be changed, duplicated, assigned to players or diverge from canonical skills/manifests',async()=>{
  const bot=rp.bots.old_plumber;
  await rejects(()=>db.query('update private.bot_teaching_fields set position=2 where actor_id=$1',[bot]));
  await rejects(()=>db.query('delete from private.bot_teaching_fields where actor_id=$1',[bot]));
  await rejects(()=>db.query("insert into private.bot_teaching_fields values($1,'plumbing',1)",[bot]),['23505']);
  await rejects(()=>db.query("insert into private.bot_teaching_fields values($1,'unknown_code',2)",[bot]),['23503']);
  await rejects(()=>db.query("insert into private.bot_teaching_fields values($1,'basic_teaching',3)",[bot]));
  await rejects(()=>db.query("insert into private.bot_teaching_fields values($1,'plumbing',1)",[actor]),['P0002']);
  await rejects(()=>db.query("update private.actor_skills set level=7,xp=1 where actor_id=$1 and skill='plumbing'",[bot]));
  await rejects(()=>db.query("update private.bot_profiles set field='fixture_carpentry' where actor_id=$1",[bot]));
  await rejects(()=>tx(async client=>{
   const intruder=await scalar("insert into private.actors(kind) values('bot') returning id",[],client);
   const home=await scalar('select home_id from private.bot_profiles where actor_id=$1',[bot],client);
   await client.query("insert into private.bot_profiles(actor_id,plan_id,home_id,display_name,role,field) values($1,$2,$3,'Fixture intruder','worker','plumbing')",[intruder,rp.plan_id,home]);
  }),['23505']);
 });
 await check('snapshot-order corruption, partial teaching and late COMMIT faults roll back all NPC/house/skill keys and permit safe retry',async()=>{
  for(const kind of ['order','missing','commit']){
   const w=await world('fault_'+kind,1),bot=job('fault_teacher','lecturer');bot.teaching_fields=['fixture_carpentry','business'];bot.levels={fixture_carpentry:6,business:6,basic_teaching:5,advanced_teaching:3};
   const s=plan('fault_'+kind,[bot],bot.teaching_fields),a=await approve(w,s);
   if(kind==='order')await db.query("create function private.test_teaching_fault() returns trigger language plpgsql as $$begin new.position:=3-new.position;return new;end$$;create trigger test_teaching_fault before insert on private.bot_teaching_fields for each row execute function private.test_teaching_fault()");
   if(kind==='missing')await db.query("create function private.test_teaching_fault() returns trigger language plpgsql as $$begin if new.skill_code='business' then return null;end if;return new;end$$;create trigger test_teaching_fault before insert on private.bot_teaching_fields for each row execute function private.test_teaching_fault()");
   if(kind==='commit')await db.query("create function private.test_teaching_fault() returns trigger language plpgsql as $$begin raise exception 'TEST_COMMIT_FAILURE';end$$;create constraint trigger test_teaching_fault after insert on private.bot_teaching_fields deferrable initially deferred for each row execute function private.test_teaching_fault()");
   try{await rejects(()=>tx(client=>provision(a,client)),kind==='commit'?['P0001']:['23514']);}finally{await db.query('drop trigger test_teaching_fault on private.bot_teaching_fields;drop function private.test_teaching_fault()');}
   assert.equal(await scalar('select count(*)::int from private.npc_plan_bindings where approval_id=$1',[a]),0);
   const r=await provision(a);assert.deepEqual(await provision(a),r);
  }
 });
 await check('TEXT-field concurrent provisioning and stale RR keep one identity; different plans cannot exceed a world budget or duplicate a pilot',async()=>{
  for(const isolation of ['read committed','repeatable read']){
   const w=await world('race_'+isolation.replaceAll(' ','_'),1),p=await approve(w,plan('race_teacher',[job('race_teacher','lecturer')],['fixture_carpentry']));
   const one=new pg.Client({connectionString:url.href}),two=new pg.Client({connectionString:url.href});await one.connect();await two.connect();
   try{await one.query('begin');await two.query('begin isolation level '+isolation);await two.query("set local statement_timeout='15s'");
    const first=await provision(p,one);assert.equal(await scalar('select count(*)::int from private.npc_plan_bindings where approval_id=$1',[p],two),0);
    const pending=provision(p,two).then(value=>({value}),error=>({error}));await one.query('commit');const second=await pending;
    if(isolation==='read committed'){assert.deepEqual(second.value,first);await two.query('commit');}else{assert.equal(second.error?.code,'40001');await two.query('rollback');assert.deepEqual(await provision(p),first);}
   }finally{await one.query('rollback');await two.query('rollback');await one.end();await two.end();}
  }
  const w=await world('budget_race',1),p1=await approve(w,plan('teacher_one',[job('teacher_one','lecturer')],['fixture_carpentry'])),p2=await approve(w,plan('teacher_two',[job('teacher_two','lecturer')],['fixture_carpentry']));
  const outcomes=await Promise.allSettled([tx(c=>provision(p1,c)),tx(c=>provision(p2,c))]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'23514');
  const secondPilot=structuredClone(pilot);secondPilot.code='second_pilot';await rejects(()=>approve(wp,secondPilot),['23505']);
 });
 await check('RLS/GRANT and owner boundaries deny API roles and super staff; catalog status alone grants no NPC authority',async()=>{
  for(const role of ['anon','authenticated','service_role']){
   for(const p of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await scalar("select has_table_privilege($1,'private.bot_teaching_fields',$2)",[role,p]),false);
   await rejects(()=>as(staff,'select * from private.bot_teaching_fields',[],role),['42501']);
   await rejects(()=>as(staff,'select private.npc_assert_teaching_coverage_text($1,$2::text[])',[rp.plan_id,['plumbing']],role),['42501']);
   await rejects(()=>as(staff,'select private.provision_npc_plan($1)',[ap],role),['42501']);
   await rejects(()=>as(staff,"insert into private.bot_teaching_fields values($1,'fixture_carpentry',2)",[rp.bots.old_plumber],role),['42501']);
  }
  try{await db.query('grant select on private.bot_teaching_fields to authenticated');assert.equal((await as(staff,'select * from private.bot_teaching_fields')).rowCount,0);}finally{await db.query('revoke select on private.bot_teaching_fields from authenticated');}
 });
 await check('old player/NPC/profile/approval/budget/source rows remain intact, actor-less users still work and no XP or course is activated',async()=>{
  const after=await rows(tables);
  for(const[k,values]of Object.entries(original)){const present=new Set(after[k].map(v=>JSON.stringify(v)));for(const v of values)assert.ok(present.has(JSON.stringify(v)),k);}
  assert.deepEqual(await hash(legacy),legacyBefore);
  assert.equal((await as(b,'select public.my_actor()')).rows[0].my_actor,null);assert.equal((await as(b,'select * from public.messages')).rowCount,1);
  const own=await scalar('select private.ensure_player_actor($1)',[b]);assert.equal((await as(b,'select public.my_actor()')).rows[0].my_actor.id,own);
  assert.equal(await scalar('select count(*)::int from private.actor_skills s join private.actors a on a.id=s.actor_id where a.kind=\'player\' and (level<>0 or xp<>0)'),0);
  assert.equal(await scalar("select private.reserve_xp_source('fixture_training',$1,$2,'plumbing','Fixture source')",[source,actor]),sourceReceipt);
  assert.equal(await scalar('select count(*)::int from public.wallets w where balance<>(select coalesce(sum(amount),0) from public.wallet_transactions t where t.user_id=w.user_id)'),0);
 });
 console.log(`${count} A2-1b NPC catalog PostgreSQL groups passed. Synthetic fixtures only; no live changes, XP awards or real Auth/MFA/Realtime/cron acceptance.`);
}finally{await db.end();await admin.query('drop database apartman_a2_npc with (force)');await admin.end();}
