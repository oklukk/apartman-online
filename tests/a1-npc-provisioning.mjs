// In-memory synthetic manifests ONLY; never a live seed/provisioning manifest.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
const code=ts.transpileModule(await readFile('src/domain/actors/index.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validatePreferredPilot}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const base='postgresql://postgres:local-test-only@127.0.0.1:55432/postgres';
const url=new URL(base);url.pathname='/apartman_a1_npc';
const admin=new pg.Client({connectionString:base}),db=new pg.Client({connectionString:url.href});
const uuid=()=>crypto.randomUUID(),copy=v=>structuredClone(v);
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
const world=(name,mode='pilot',limit=2,c=db)=>scalar('select private.register_npc_world($1,$2,$3,$4,$5)',[name,mode,limit,'test-approval','Disposable test approval'],c);
const approve=(w,s,c=db)=>scalar('select private.approve_npc_plan($1,$2,$3,$4)',[w,s,'test-approval','Disposable test approval'],c);
const provision=(a,c=db)=>scalar('select private.provision_npc_plan($1)',[a],c);
function pilot(name='test_pilot'){
 return {code:name,scope:'pilot',population_limit:2,required_teaching_fields:['plumbing','business'],
 buildings:[{key:'test_building',name:'Fixture NPC apartmanı',capacity:12}],
 bots:[{key:'test_plumber',name:'Fixture öğretmen A',building_key:'test_building',home_number:1,role:'lecturer',field:'plumbing',teaching_fields:['plumbing'],levels:{plumbing:6,basic_teaching:5,advanced_teaching:3}},
 {key:'test_business',name:'Fixture öğretmen B',building_key:'test_building',home_number:2,role:'lecturer',field:'business',teaching_fields:['business'],levels:{business:6,basic_teaching:5,advanced_teaching:3}}]};
}
function ordinary(name='test_plan',role='worker'){
 return {code:name,scope:'world',population_limit:1,required_teaching_fields:[],buildings:[{key:name+'_building',name:'Fixture bina',capacity:2}],
 bots:[{key:name+'_bot',name:'Fixture çalışan',building_key:name+'_building',home_number:1,role,field:'plumbing',teaching_fields:[],levels:role==='worker'?{plumbing:3}:{plumbing:4,business:4}}]};
}
// Deliberately bypass the provisioning function to prove deferred SQL constraints,
// using one synthetic ordinary worker. This is not an operational seed helper.
async function rawWorker(c,approval,s,name=s.bots[0].name){
 const meta=(await c.query('select * from private.npc_plan_approvals where id=$1',[approval])).rows[0];
 const p=uuid(),building=uuid(),actor=uuid(),home=uuid(),otherHome=uuid(),bot=s.bots[0];
 await c.query('insert into private.npc_plan_bindings values($1,$2,$3,$4)',[p,approval,meta.world_id,'world']);
 await c.query("insert into private.npc_population_plans(id,code,scope,population_limit) values($1,$2,'world',1)",[p,'np_'+approval.replaceAll('-','')]);
 await c.query('insert into private.npc_buildings values($1,$2,$3,2)',[building,p,s.buildings[0].name]);
 await c.query('insert into private.npc_building_keys values($1,$2,$3,$4)',[p,meta.world_id,s.buildings[0].key,building]);
 await c.query('insert into private.npc_homes values($1,$2,$3,1),($4,$2,$3,2)',[home,p,building,otherHome]);
 await c.query("insert into private.actors(id,kind) values($1,'bot')",[actor]);
 await c.query("insert into private.bot_profiles(actor_id,plan_id,home_id,display_name,role,field) values($1,$2,$3,$4,'worker','plumbing')",[actor,p,home,name]);
 await c.query('insert into private.npc_actor_keys values($1,$2,$3,$4)',[p,meta.world_id,bot.key,actor]);
 await c.query("insert into private.actor_skills values($1,'plumbing',3,0)",[actor]);
}
const q=s=>'"'+s.replaceAll('"','""')+'"';
async function fingerprints(tables){
 const rows={};for(const {schemaname:s,tablename:t} of tables)rows[s+'.'+t]=(await db.query(`select count(*)::int n,md5(coalesce(string_agg(row_to_json(r)::text,E'\n' order by row_to_json(r)::text),'')) hash from ${q(s)}.${q(t)} r`)).rows[0];return rows;
}
async function catalog(){return(await db.query(`select 'function' kind,n.nspname||'.'||p.oid::regprocedure::text key,jsonb_build_object('src',prosrc,'acl',proacl,'config',proconfig,'definer',prosecdef) value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth','cron')
 union all select 'policy',schemaname||'.'||tablename||'.'||policyname,to_jsonb(p) from pg_policies p
 union all select 'table',n.nspname||'.'||c.relname,jsonb_build_object('acl',relacl,'rls',relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','cron') and relkind in ('r','v')
 union all select 'trigger',tgrelid::regclass::text||'.'||tgname,to_jsonb(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal
 union all select 'publication',pubname,to_jsonb(p) from pg_publication p
 union all select 'publication_table',pubname||'.'||schemaname||'.'||tablename,to_jsonb(p) from pg_publication_tables p order by 1,2`)).rows;}
await admin.connect();await admin.query('create database apartman_a1_npc');await db.connect();
try{
 for(const role of ['anon','authenticated','service_role'])if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await admin.query('create role '+role+' nologin');
 await db.query(`create schema auth;create schema extensions;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);create table auth.mfa_factors(user_id uuid references auth.users,status text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;create publication supabase_realtime;
 -- Registration stub only, NOT a pg_cron worker.
 create schema cron;create table cron.job(id bigint generated always as identity,jobname text unique,schedule text,command text);
 create function cron.schedule(n text,s text,c text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(n,s,c) returning id$$;`);
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();assert.ok(files.length>=10);assert.match(files[9],/_a1_controlled_npc_provisioning\.sql$/); // historical first10 migrations
 for(const f of files.slice(0,9)){await db.query('begin');await db.query((await readFile('supabase/migrations/'+f,'utf8')).replace(/create extension if not exists pg_cron with schema pg_catalog;/g,''));await db.query('commit');}
 const [a,b,staff]=[uuid(),uuid(),uuid()];
 for(const [i,u]of[a,b,staff].entries())await db.query('insert into auth.users values($1,$2,now())',[u,{username:'npc_fixture_'+i}]);
 const building=await scalar("select id from public.buildings where slug='cinar'");
 await db.query("insert into private.invitations(building_id,code_hash,expires_at,uses_remaining) values($1,sha256(convert_to('npc-fixture','UTF8')),now()+interval '1 day',12)",[building]);
 await as(a,"select public.join_building('npc-fixture')");await as(b,"select public.join_building('npc-fixture')");
 await as(a,"select public.player_action('job','technical')");await as(a,"select public.send_message('Korunan NPC öncesi mesaj')");
 const poll=await scalar('select id from public.polls limit 1');await as(a,'select public.cast_vote($1,true)',[poll]);
 await db.query('select private.run_v02()');const election=await scalar('select id from public.elections limit 1');
 await db.query("insert into public.election_candidates(election_id,user_id,building_id,statement) values($1,$2,$3,'Korunan aday')",[election,a,building]);
 await db.query('insert into public.election_votes(election_id,user_id,candidate_id,building_id) values($1,$2,$2,$3)',[election,a,building]);
 await db.query("insert into public.dues(building_id,user_id,week_start,amount) values($1,$2,date_trunc('week',now() at time zone 'Europe/Istanbul')::date,150)",[building,a]);
 await db.query("insert into public.manager_terms(building_id,user_id,starts_at,ends_at) values($1,$2,now(),now()+interval '14 days')",[building,a]);
 await db.query("insert into auth.mfa_factors values($1,'verified')",[staff]);await db.query("select private.staff_bootstrap($1,'Fixture NPC sahibi')",[staff]);
 await db.query('select private.ensure_player_actor($1)',[a]);
 const existing=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','cron') order by 1,2")).rows;
 const before=await fingerprints(existing),schema=await catalog();
 const migration=await readFile('supabase/migrations/'+files[9],'utf8');
 await check('pre-existing unbound NPC plans survive migration unchanged but block new provisioning until separately reviewed',async()=>{
  await db.query('begin');
  try{
   await db.query("insert into private.npc_population_plans(code,scope,population_limit) values('legacy_fixture','world',0)");
   const snap=await fingerprints(existing);await db.query(migration);assert.deepEqual(await fingerprints(existing),snap);
   await db.query('savepoint check_block');await rejects(()=>world('blocked_fixture'));
   await db.query('rollback to savepoint check_block');
  }finally{await db.query('rollback');} // Removes only this staged migration/test fixture, before the real test apply.
 });
 await db.query('begin');await db.query(migration);await db.query('commit');
 const newTables=['npc_worlds','npc_plan_approvals','npc_plan_bindings','npc_building_keys','npc_actor_keys'];
 const allNpcTables=['npc_population_plans','npc_buildings','npc_homes','bot_profiles',...newTables];
 const unchanged=existing.filter(x=>!(x.schemaname==='private'&&['actors','actor_skills',...allNpcTables].includes(x.tablename)));
 const legacy=await fingerprints(unchanged);
 await check('definition-only migration changes no old row/RPC/grant/RLS/trigger/cron/publication and seeds nothing',async()=>{
  assert.deepEqual(await fingerprints(existing),before);const after=new Map((await catalog()).map(r=>[r.kind+':'+r.key,r.value]));
  for(const r of schema)assert.deepEqual(after.get(r.kind+':'+r.key),r.value,r.key);
  for(const t of newTables)assert.equal(await scalar('select count(*)::int from private.'+t),0);
 });
 const w=await world('test_main');const spec=pilot();const ap=await approve(w,spec);
 await check('world and plan approval are explicit, immutable, scoped and idempotent; no NPC is created by approval',async()=>{
  assert.equal(await world('test_main'),w);assert.equal(await approve(w,copy(spec)),ap);
  const worlds=await Promise.all([tx(c=>world('test_same_world','pilot',2,c)),tx(c=>world('test_same_world','pilot',2,c))]);
  assert.equal(worlds[0],worlds[1]);
  const approvals=await Promise.all([tx(c=>approve(worlds[0],spec,c)),tx(c=>approve(worlds[0],copy(spec),c))]);
  assert.equal(approvals[0],approvals[1]);
  assert.equal(await scalar('select count(*)::int from private.bot_profiles'),0);
  await rejects(()=>world('test_main','world',20));
  const changed=copy(spec);changed.bots[0].name='Changed fixture';await rejects(()=>approve(w,changed));
  await rejects(()=>approve(w,pilot('second_pilot')),['23505']);
  await rejects(()=>db.query('update private.npc_worlds set population_limit=20 where id=$1',[w]));
  await rejects(()=>db.query('delete from private.npc_plan_approvals where id=$1',[ap]));
  await rejects(()=>provision(uuid()),['P0002']);
 });
 const result=await provision(ap);
 await check('pilot creates exactly two 6/5/3 lecturers, 12 separate NPC homes and stable identifiers; replay is byte-identical',async()=>{
  const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','cron') order by 1,2")).rows;
  const saved=await fingerprints(tables);assert.deepEqual(await provision(ap),result);assert.deepEqual(await fingerprints(tables),saved);
  assert.equal(Object.keys(result.bots).length,2);assert.equal(Object.keys(result.buildings.test_building.homes).length,12);
  const actors=(await db.query('select b.*,to_jsonb(b.teaching_fields) fields,h.number,h.building_id from private.bot_profiles b join private.npc_homes h on h.id=b.home_id where b.plan_id=$1',[result.plan_id])).rows;
  const bots=[];for(const row of actors){
   const levels=Object.fromEntries((await db.query('select skill,level from private.actor_skills where actor_id=$1',[row.actor_id])).rows.map(x=>[x.skill,x.level]));
   bots.push({kind:'bot',id:row.actor_id,name:row.display_name,homeId:row.home_id,role:row.role,field:row.field,teachingFields:row.fields,levels});
  }
  assert.notEqual(bots[0].homeId,bots[1].homeId);
  assert.deepEqual(validatePreferredPilot({scope:'pilot',populationLimit:2,residentProfileIds:[],players:[],bots,
   buildings:[{id:result.buildings.test_building.id,kind:'npc',capacity:12}],homes:Object.entries(result.buildings.test_building.homes).map(([number,id])=>({id,buildingId:result.buildings.test_building.id,number:Number(number)})),
   activeTeachingFields:['plumbing','business'],zeroLevelLearningPaths:[{field:'plumbing',entryLevel:0},{field:'business',entryLevel:0}],assignments:[]}),{ok:true,issues:[]});
  await db.query('select private.npc_assert_teaching_coverage($1,$2)',[result.plan_id,['plumbing','business']]);
  await rejects(()=>db.query('select private.npc_assert_teaching_coverage($1,$2)',[result.plan_id,['advanced_teaching']]));
 });
 await check('invalid manifests: fixed skills, extras, missing pedagogy, duplicate home/key, wrong building and coverage fail before provisioning',async()=>{
  const bad=[];const mutate=fn=>{const s=copy(spec);fn(s);bad.push(s);};
  mutate(s=>s.bots[0].levels.plumbing=5);mutate(s=>s.bots[0].levels.business=10);mutate(s=>delete s.bots[0].levels.basic_teaching);
  mutate(s=>s.bots[0].levels.plumbing='6');mutate(s=>s.bots[0].xp=1);mutate(s=>s.bots[0].role=null);
  mutate(s=>s.bots[1].home_number=1);mutate(s=>s.bots[0].home_number=13);mutate(s=>s.bots[0].building_key='unknown');
  mutate(s=>s.bots[1].key=s.bots[0].key);mutate(s=>s.required_teaching_fields.push('advanced_teaching'));
  mutate(s=>s.bots[0].teaching_fields.push('plumbing'));mutate(s=>s.population_limit=3);mutate(s=>s.extra='ignored?');mutate(s=>s.scope=null);
  for(const s of bad)await rejects(()=>approve(w,s),['23514','22P02']);
  await rejects(()=>db.query("insert into private.npc_plan_approvals(world_id,code,scope,spec,approval_ref,reason) values($1,'different_key','pilot',$2,'test-ref','Fixture direct approval')",[w,spec]));
 });
 await check('direct unbound/wrong-plan writes and stable-key reuse cannot bypass approval, exact snapshot, occupancy or total budget',async()=>{
  await rejects(()=>db.query("insert into private.npc_population_plans(code,scope,population_limit) values('unbound','world',2)"));
  await rejects(()=>db.query('insert into private.npc_homes(plan_id,building_id,number) values($1,$2,13)',[result.plan_id,result.buildings.test_building.id]));
  await rejects(()=>db.query('insert into private.npc_plan_bindings values($1,$2,$3,$4)',[uuid(),ap,w,'world']),['23503','23505']);
  await rejects(()=>tx(async c=>{
   const actor=await scalar("insert into private.actors(kind) values('bot') returning id",[],c);
   await c.query("insert into private.bot_profiles(actor_id,plan_id,home_id,display_name,role,field) values($1,$2,$3,'Intruder','worker','plumbing')",[actor,result.plan_id,result.buildings.test_building.homes['1']]);
  }),['23505']);
  // Different worlds are legitimate independent scope, not a permanent global cap2.
  const w2=await world('test_other');const a2=await approve(w2,spec);const r2=await provision(a2);
  assert.notEqual(r2.plan_id,result.plan_id);assert.notDeepEqual(r2.bots,result.bots);
  assert.equal(await scalar('select count(*)::int from private.bot_profiles'),4);
 });
 await check('world plans share a nonresetting budget and stable bot/building keys cannot clone an NPC via a new plan',async()=>{
  const wg=await world('test_shared','world',2);
  const s1=ordinary('first_plan'),s2=ordinary('second_plan');
  const p1=await approve(wg,s1),p2=await approve(wg,s2);
  let assembled=false;
  await rejects(()=>tx(async c=>{await rawWorker(c,p1,s1,'Wrong snapshot name');assembled=true;}));
  assert.equal(assembled,true,'All raw INSERTs should finish before the deferred snapshot rejection');
  await provision(p1);await provision(p2);
  const p3=await approve(wg,ordinary('third_plan'));await rejects(()=>provision(p3));
  assembled=false;
  await assert.rejects(()=>tx(async c=>{await rawWorker(c,p3,ordinary('third_plan'));assembled=true;}),e=>e.code==='23514'&&/dünya nüfus bütçesi/.test(e.message));
  assert.equal(assembled,true,'Shared budget must also reject raw DML at COMMIT, independently of the provisioning function');
  assert.equal(await scalar('select count(*)::int from private.npc_plan_bindings where world_id=$1',[wg]),2);
  const reuse=ordinary('reuse_plan');reuse.bots[0].key=s1.bots[0].key;
  const pr=await approve(wg,reuse);await rejects(()=>provision(pr),['23505']);
 });
 await check('multi-field lecturers and existing worker3/operator4 policy remain valid; extra worker/operator skills are rejected',async()=>{
  const wg=await world('test_roles','world',4);
  for(const role of ['worker','operator']){
   const s=ordinary('test_'+role,role);const p=await approve(wg,s);await provision(p);
   const wrong=ordinary('bad_'+role,role);wrong.bots[0].levels.advanced_teaching=0;await rejects(()=>approve(wg,wrong));
  }
  const s=ordinary('test_multi');s.required_teaching_fields=['plumbing','business','basic_teaching','advanced_teaching'];
  Object.assign(s.bots[0],{role:'lecturer',teaching_fields:s.required_teaching_fields,levels:Object.fromEntries(s.required_teaching_fields.map(f=>[f,6]))});
  const p=await approve(wg,s),r=await provision(p);await db.query('select private.npc_assert_teaching_coverage($1,$2)',[r.plan_id,s.required_teaching_fields]);
 });
 await check('concurrent identical provisioning returns one result at RC; stale RR requires whole-transaction retry',async()=>{
  for(const isolation of ['read committed','repeatable read']){
   const wi=await world('race_'+isolation.replaceAll(' ','_'));const ai=await approve(wi,spec);
   const one=new pg.Client({connectionString:url.href}),two=new pg.Client({connectionString:url.href});await one.connect();await two.connect();
   try{
    await one.query('begin');await two.query('begin isolation level '+isolation);await two.query("set local statement_timeout='15s'");
    const first=await provision(ai,one);
    assert.equal(await scalar('select count(*)::int from private.npc_plan_bindings where approval_id=$1',[ai],two),0);
    const pending=provision(ai,two).then(value=>({value}),error=>({error}));await one.query('commit');const second=await pending;
    if(isolation==='read committed'){assert.deepEqual(second.value,first);await two.query('commit');}
    else{assert.equal(second.error?.code,'40001');await two.query('rollback');assert.deepEqual(await provision(ai),first);}
    assert.equal(await scalar('select count(*)::int from private.npc_plan_bindings where world_id=$1',[wi]),1);
   }finally{await one.query('rollback');await two.query('rollback');await one.end();await two.end();}
  }
 });
 await check('concurrent different pilot approvals cannot open two active pilots in one world',async()=>{
  const wi=await world('test_pilot_race');
  const outcomes=await Promise.allSettled([tx(c=>approve(wi,pilot('pilot_alpha'),c)),tx(c=>approve(wi,pilot('pilot_beta'),c))]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'23505');
  const winner=outcomes.find(r=>r.status==='fulfilled').value;await provision(winner);
  assert.equal(await scalar('select count(*)::int from private.npc_plan_approvals where world_id=$1',[wi]),1);
 });
 await check('concurrent different world plans cannot exceed their shared budget',async()=>{
  const wi=await world('test_budget_race','world',1),pa=await approve(wi,ordinary('budget_one')),pb=await approve(wi,ordinary('budget_two'));
  const outcomes=await Promise.allSettled([tx(c=>provision(pa,c)),tx(c=>provision(pb,c))]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'23514');
  assert.equal(await scalar('select count(*)::int from private.bot_profiles b join private.npc_plan_bindings p on p.plan_id=b.plan_id where p.world_id=$1',[wi]),1);
 });
 await check('mid-skill, late COMMIT and caller rollback leave no partial NPC/keys/homes; retry safely finishes the approved plan',async()=>{
  for(const fault of ['skill','commit','caller']){
   const wi=await world('test_fault_'+fault),pa=await approve(wi,spec);
   const npcTables=(await db.query("select schemaname,tablename from pg_tables where schemaname='private' and tablename not like 'staff%' and tablename<>'player_sanctions' order by 1,2")).rows;
   const snap=await fingerprints(npcTables);
   if(fault==='skill')await db.query(`create function private.test_npc_fault() returns trigger language plpgsql as $$begin if new.skill='business' then raise exception 'NPC_SKILL_TEST';end if;return new;end$$;
     create trigger test_npc_fault before insert on private.actor_skills for each row execute function private.test_npc_fault();`);
   if(fault==='commit')await db.query(`create function private.test_npc_fault() returns trigger language plpgsql as $$begin raise exception 'NPC_COMMIT_TEST';end$$;
     create constraint trigger test_npc_fault after insert on private.npc_plan_bindings deferrable initially deferred for each row execute function private.test_npc_fault();`);
   try{
    if(fault==='caller'){const marker=new Error('rollback fixture');await assert.rejects(()=>tx(async c=>{await provision(pa,c);throw marker;}),e=>e===marker);}
    else await rejects(()=>tx(c=>provision(pa,c)),['P0001']);
   }finally{
    if(fault==='skill')await db.query('drop trigger test_npc_fault on private.actor_skills;drop function private.test_npc_fault()');
    if(fault==='commit')await db.query('drop trigger test_npc_fault on private.npc_plan_bindings;drop function private.test_npc_fault()');
   }
   assert.deepEqual(await fingerprints(npcTables),snap);const r=await provision(pa);assert.deepEqual(await provision(pa),r);
  }
 });
 await check('API roles and super staff cannot provision/approve/read/write; RLS and independent owner checks stay closed',async()=>{
  const functions=(await db.query("select p.oid::regprocedure::text signature,prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (proname like 'npc_%' or proname in ('register_npc_world','approve_npc_plan','provision_npc_plan'))")).rows;
  for(const f of functions){assert.equal(f.prosecdef,false);assert.ok(f.proconfig.includes('search_path=""'));
   for(const role of ['anon','authenticated','service_role'])assert.equal(await scalar("select has_function_privilege($1,$2,'EXECUTE')",[role,f.signature]),false);}
  for(const role of ['anon','authenticated','service_role']){
   await rejects(()=>as(staff,'select private.provision_npc_plan($1)',[ap],role),['42501']);
   await rejects(()=>as(staff,'select private.approve_npc_plan($1,$2,$3,$4)',[w,spec,'test-ref','Test gerekçe'],role),['42501']);
   await rejects(()=>as(staff,"select private.register_npc_world('unauthorized','pilot',2,'test-ref','Test gerekçe')",[],role),['42501']);
   for(const t of newTables){for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await scalar('select has_table_privilege($1,$2,$3)',[role,'private.'+t,privilege]),false);
    await rejects(()=>as(staff,'select * from private.'+t,[],role),['42501']);await rejects(()=>as(staff,'insert into private.'+t+' default values',[],role),['42501']);}
  }
  try{
   await db.query('grant execute on function private.provision_npc_plan(uuid),private.npc_owner_check() to authenticated');
   await rejects(()=>as(staff,'select private.provision_npc_plan($1)',[ap]),['42501']);
   for(const t of newTables)await db.query('grant select on private.'+t+' to authenticated');
   for(const t of newTables)assert.equal((await as(staff,'select * from private.'+t)).rowCount,0);
  }finally{await db.query('revoke execute on function private.provision_npc_plan(uuid),private.npc_owner_check() from authenticated');for(const t of newTables)await db.query('revoke select on private.'+t+' from authenticated');}
  await rejects(()=>as(staff,'select public.provision_npc_plan($1)',[ap]),['42883']);
 });
 await check('the existing owner-only player initializer and self projection work after NPC schema changes without touching NPC records',async()=>{
  const npcState=await fingerprints(allNpcTables.map(tablename=>({schemaname:'private',tablename})));
  const id=await scalar('select private.ensure_player_actor($1)',[b]);
  assert.equal(await scalar('select private.ensure_player_actor($1)',[b]),id);
  assert.equal((await as(b,'select public.my_actor()')).rows[0].my_actor.id,id);
  assert.deepEqual(await fingerprints(allNpcTables.map(tablename=>({schemaname:'private',tablename}))),npcState);
 });
 await check('NPCs never acquire Auth/profile/wallet/real resident or election authority; all legacy records and player skills survive',async()=>{
  for(const id of Object.values(result.bots)){
   assert.equal(await scalar('select count(*)::int from auth.users where id=$1',[id]),0);assert.equal(await scalar('select count(*)::int from public.profiles where id=$1',[id]),0);
   assert.equal(await scalar('select count(*)::int from public.wallets where user_id=$1',[id]),0);
   await rejects(()=>as(id,'select public.election_action($1,$2,$3)',[election,'nominate','Sahte aday']),['P0001']);
   await rejects(()=>as(id,'select public.cast_vote($1,true)',[poll]),['P0001']);
  }
  assert.deepEqual(await fingerprints(unchanged),legacy);
  assert.equal(await scalar('select count(*)::int from private.actor_skills s join private.actors a on a.id=s.actor_id where a.kind=\'player\''),8);
  assert.equal(await scalar('select count(*)::int from public.wallets w where balance<>(select coalesce(sum(amount),0) from public.wallet_transactions t where t.user_id=w.user_id)'),0);
 });
 console.log(`${count} controlled NPC PostgreSQL integration groups passed. Synthetic disposable fixtures ONLY; no live manifest/seed. Auth HTTP/MFA/Realtime and actual cron NOT tested.`);
}finally{await db.end();await admin.query('drop database apartman_a1_npc with (force)');await admin.end();}
