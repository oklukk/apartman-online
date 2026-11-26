// Isolated synthetic staff RPC adapter. Never imported by the production application.
export function createStaffFixture(scenario:string) {
 const building='fixture-building',other='fixture-other';
 const admin=['staff.roles.read','staff.audit.read','players.read','players.profile.edit','players.moderate','players.ban','economy.read','economy.wallet.adjust','economy.treasury.adjust','economy.settings.manage','governance.read','governance.elections.manage','governance.manager.appoint','world.buildings.read','world.buildings.rename'];
 const moderator=['players.read','players.moderate','governance.read'];
 const editor=['world.buildings.read','content.announcements.manage','content.events.manage'];
 const scoped=scenario.includes('scoped') || scenario.includes('ban-only') || scenario.includes('audit-only');
 const role=scenario.includes('moderator')?'moderator':scenario.includes('editor')?'editor':scenario.includes('admin') || scenario.includes('scoped')?'admin':scenario.includes('ban-only') || scenario.includes('audit-only')?'custom':'super_admin';
 const permissions=scenario.includes('audit-only')?['staff.audit.read','world.buildings.read']:scenario.includes('ban-only')?['players.ban','governance.manager.appoint']:role==='moderator'?moderator:role==='editor'?editor:role==='admin'?admin:[];
 const titles:Record<string,string>={super_admin:'Süper Yönetici',admin:'Yönetici',moderator:'Moderatör',editor:'Editör',custom:'Özel görev'};
 let identity:any={roles:scenario==='staff-none'?[]:[{code:role,title:titles[role],scope_kind:scoped?'building':'global',scope_id:scoped?building:''}],permissions:scoped?[]:permissions,scoped_permissions:scoped?[{building_id:building,permissions}]:[]};
 let failure='',revision='revision-1',afterWrite=false,writeDelay=0,aal2=!scenario.includes('aal1');
 let governanceGate:Promise<void>|null=null,releaseGovernance:(()=>void)|null=null;
 let identityGate:Promise<void>|null=null,releaseIdentity:(()=>void)|null=null;
 let release!:()=>void;const barrier=scenario==='staff-loading'?new Promise<void>(r=>{release=r;}):Promise.resolve();
 const calls:{rpc:string;args:any}[]=[],applied:{rpc:string;args:any}[]=[],ids=new Map<string,string>();
 const records=[{user_id:'fixture-player',username:'Deniz',building_id:building,balance:300},{user_id:'neighbor',username:'Ece',building_id:building,balance:325},{user_id:'other-player',username:'Pelin',building_id:other,balance:800}];
 const buildings=[{id:building,name:'Çınar Apartmanı',treasury:3800,settings:{daily_salary:100,side_job_reward:25,weekly_dues:150,weekly_dues_next_week:150,weekly_dues_next_week_starts:'2026-11-30',cleaning_base:80,cleaning_per_resident:20,maintenance_base:50,maintenance_per_resident:10,initial_balance:300}},{id:other,name:'Defne Apartmanı',treasury:2500,settings:null}];
 const logs:any[]=[{id:'audit-wallet',action:'wallet.adjust',target_type:'user',target_id:'neighbor',reason:'Test düzeltme gerekçesi',old_value:{balance:300},new_value:{balance:325,delta:25,building_id:building},created_at:'2026-11-26T09:00:00Z'},{id:'audit-treasury',action:'treasury.adjust',target_type:'building',target_id:building,reason:'Ortak kasa test kaydı',old_value:{balance:4000},new_value:{balance:3800,delta:-200},created_at:'2026-11-26T08:00:00Z'}];
 const superRole=()=>identity.roles.some((r:any)=>r.code==='super_admin' && r.scope_kind==='global');
 const can=(permission:string,b?:unknown)=>superRole() || identity.permissions.includes(permission) || identity.scoped_permissions.some((s:any)=>s.building_id===b && s.permissions.includes(permission));
 const good=(data:unknown)=>({data,error:null});const bad=(message:string)=>({data:null,error:{message}});
 const allPermissions=[...new Set([...admin,...moderator,...editor,'governance.elections.override'])];
 Object.assign(window,{fixtureStaff:{calls,applied,setFailure:(mode:string)=>{failure=mode;if(mode==='stale')revision='revision-2';},delayWrites:(ms:number)=>{writeDelay=ms;},releaseReads:()=>release?.(),holdGovernance:()=>{governanceGate=new Promise(resolve=>{releaseGovernance=resolve;});},releaseGovernance:()=>{releaseGovernance?.();governanceGate=null;},revoke:()=>{identity={roles:[],permissions:[],scoped_permissions:[]};window.dispatchEvent(new Event('focus'));},verify:()=>{aal2=true;},switchToModerator:()=>{identity={roles:[{code:'moderator',title:'Moderatör',scope_kind:'global',scope_id:''}],permissions:moderator,scoped_permissions:[]};}}});
 Object.assign((window as any).fixtureStaff,{holdIdentity:()=>{identityGate=new Promise(resolve=>{releaseIdentity=resolve;});},releaseIdentity:()=>releaseIdentity?.()});
 return {verify:()=>{aal2=true;},handle:async(rpc:string,args:Record<string,unknown>={})=>{
  calls.push({rpc,args:JSON.parse(JSON.stringify(args))});
  if(rpc==='staff_me'){const snapshot=identity;const gate=identityGate;identityGate=null;if(gate)await gate;return good(snapshot);}
  if(!identity.roles.length)return bad('Bu işlem için yetkiniz yok.');
  const read=['staff_directory','staff_game_overview','staff_governance_state','staff_operations_history','staff_sanction_history'].includes(rpc);
  if(read){await barrier;if(scenario==='staff-read-error' || failure==='read' || (failure==='refresh' && afterWrite))return bad('Bilgiler yüklenemedi.');}
  if(rpc==='staff_directory') {
   if(!can('staff.roles.read') && !buildings.some(b=>can('world.buildings.read',b.id)||can('world.buildings.rename',b.id)))return bad('Bu işlem için yetkiniz yok.');
   return good({roles:can('staff.roles.read')?['super_admin','admin','moderator','editor'].map((code,i)=>({id:i+1,code,title:titles[code],description:'Test rolü',system_role:true,permissions:code==='admin'?admin:code==='moderator'?moderator:code==='editor'?editor:[]})):[],permissions:can('staff.roles.read')?allPermissions.map(code=>({code,title:code,category:'Mevcut izinler'})):[],users:can('staff.roles.read')?records:[],buildings:buildings.filter(b=>can('staff.roles.read')||can('world.buildings.read',b.id)||can('world.buildings.rename',b.id)).map(b=>({id:b.id,name:b.name})),assignments:can('staff.roles.read')?[{id:'assignment1',user_id:'neighbor',role:'moderator',scope_kind:'building',scope_id:building}]:[],audit:can('staff.audit.read')?logs:[]});
  }
  if(rpc==='staff_game_overview')return good({players:scenario==='staff-empty'?[]:records.filter(p=>['players.read','players.profile.edit','players.moderate','players.ban','economy.read','economy.wallet.adjust'].some(k=>can(k,p.building_id))).map(p=>({...p,balance:can('economy.read',p.building_id)||can('economy.wallet.adjust',p.building_id)?p.balance:null,can_read_balance:can('economy.read',p.building_id)||can('economy.wallet.adjust',p.building_id)})),buildings:scenario==='staff-empty'?[]:buildings.filter(b=>['players.moderate','players.ban','governance.read','governance.elections.manage','governance.elections.override','governance.manager.appoint','economy.read','economy.wallet.adjust','economy.treasury.adjust','economy.settings.manage'].some(k=>can(k,b.id))).map(b=>({...b,treasury:can('economy.read',b.id)||can('economy.treasury.adjust',b.id)?b.treasury:null,settings:can('economy.read',b.id)||can('economy.settings.manage',b.id)?b.settings:null}))});
  if(rpc==='staff_governance_state' && governanceGate)await governanceGate;
  if(rpc==='staff_governance_state')return ['governance.read','governance.elections.manage','governance.elections.override','governance.manager.appoint'].some(k=>can(k,args.target_building))?good({revision,state:{elections:[{id:'election1',status:'voting'}],candidates:[{user_id:'neighbor'}],votes:[{candidate_id:'neighbor'}],manager_terms:[{id:'term1',user_id:'neighbor',ends_at:'2026-12-10T10:00:00Z'}],polls:[{id:'poll1',status:'open'}],treasury:3800}}):bad('Bu işlem için yetkiniz yok.');
  if(rpc==='staff_operations_history')return can('staff.audit.read',args.target_building)?good(scenario==='staff-empty'?[]:logs):bad('Denetim izni gerekli.');
  if(rpc==='staff_sanction_history')return can('players.moderate',building)||can('players.ban',building)?good([{id:'sanction1',kind:'warning',reason:'Sentetik uyarı kaydı',expires_at:null,revoked_at:null}]):bad('Bu işlem için yetkiniz yok.');
  if(writeDelay)await new Promise(resolve=>setTimeout(resolve,writeDelay));
  if(!aal2 || failure==='aal1')return bad('Yönetim işlemleri için çok faktörlü doğrulama gerekli.');
  if(failure==='network')throw new Error('Failed to fetch');
  const p=records.find(p=>p.user_id===args.target_user);
  const target=args.target_building || p?.building_id || building;
  const permission:Record<string,string>={staff_rename_player:'players.profile.edit',staff_adjust_wallet:'economy.wallet.adjust',staff_adjust_treasury:'economy.treasury.adjust',staff_update_economy:'economy.settings.manage',staff_rename_building:'world.buildings.rename',staff_compensate:args.original_audit_id==='audit-wallet'?'economy.wallet.adjust':'economy.treasury.adjust',staff_sanction:['ban','unban'].includes(String(args.action))?'players.ban':'players.moderate'};
  if(rpc==='staff_governance_action'){
   const action=String(args.action);const perm=action==='election.force'||action.startsWith('poll.force')?'governance.elections.override':action.startsWith('manager.')?'governance.manager.appoint':'governance.elections.manage';
   if(!can(perm,target))return bad('Bu işlem için yetkiniz yok.');
   if(args.expected_revision!==revision)return bad('Önizleme değişmiş. Güncel durumu yeniden yükleyin.');
  }else if(permission[rpc]?!can(permission[rpc],target):!superRole())return bad('Bu işlem için yetkiniz yok.');
  if(args.operation_id){const id=String(args.operation_id),payload=JSON.stringify({rpc,args});if(ids.has(id)){if(ids.get(id)!==payload)return bad('İşlem kimliği farklı içerikle kullanılmış.');return good(null);}ids.set(id,payload);}
  applied.push({rpc,args});afterWrite=true;
  if(rpc==='staff_adjust_wallet' && p)p.balance+=Number(args.amount);
  if(rpc==='staff_rename_player' && p)p.username=String(args.new_username);
  if(rpc==='staff_adjust_treasury')buildings.find(b=>b.id===target)!.treasury+=Number(args.amount);
  if(failure==='network-after-apply'){failure='';throw new Error('Failed to fetch');}
  return good(null);
 }};
}
