// Browser fixture: synthetic data; not an Auth/Realtime implementation or production client.
const scenario = new URLSearchParams(location.search).get('scenario') || 'resident';
const delay = new URLSearchParams(location.search).get('delay');
let releaseInitial!: () => void;
const initialGate = delay === 'initial' ? new Promise<void>(resolve => { releaseInitial=resolve; }) : Promise.resolve();
let targetAvailable = delay !== 'target';
let publish: () => void = () => {};
Object.assign(window,{fixtureReleaseInitial:()=>releaseInitial?.(),fixturePublishTarget:()=>{targetAvailable=true;publish();}});
const now = Date.now(), iso = (offset = 0) => new Date(now + offset).toISOString();
const unjoined = ['unjoined','staff-unjoined'].includes(scenario);
const staff = ['staff','staff-unjoined'].includes(scenario);
const user = 'fixture-player', building = 'fixture-building';
const economy = {
  wallets: [{user_id:user,balance:300,job:'office',job_changed_at:null,employment_started_on:'2026-11-01',side_job_started_at:null}],
  wallet_transactions:[{id:'t',kind:'starting',amount:300,balance_after:300,description:'Başlangıç bakiyesi',period_key:'once',created_at:iso()}],
  dues:[{id:'due',user_id:user,week_start:'2026-11-23',amount:150,paid_at:null}],
  economy_settings:[{building_id:building,first_week:'2026-11-23',weekly_dues:150,daily_salary:100,side_job_reward:25,cleaning_base:80,cleaning_per_resident:20,maintenance_base:50,maintenance_per_resident:10}],
  operating_expenses:[],treasury_history:[{id:'h',amount:-1200,kind:'poll',description:'Asansör tamiri',created_at:iso()}],
  elections:[{id:'election1',starts_at:iso(-7200000),nominations_end:iso(-3600000),voting_end:iso(86400000),status:'voting',electorate_size:2,quorum:2}],
  election_candidates:[{election_id:'election1',user_id:'neighbor',statement:'Ortak yaşamı birlikte iyileştirelim.'}],
  election_votes:[],election_electorate:[{election_id:'election1',user_id:user}],
  manager_terms:['manager','expired-manager','future-manager','voided-manager'].includes(scenario)?[{id:'term',building_id:building,user_id:user,starts_at:iso(scenario==='future-manager'?86400000:-86400000),ends_at:iso(scenario==='expired-manager'?-1000:172800000),voided:scenario==='voided-manager'}]:[],
  dues_rates:[],expense_catalog:[{kind:'door',title:'Kapı onarımı',cost:300}],dues_overview:[],
};
const tables: Record<string, unknown[]> = {
  ...economy, profiles:[{id:user,username:'Deniz'},{id:'neighbor',username:'Ece'}],
  memberships:unjoined?[]:[{user_id:user,building_id:building,apartment_id:'apt1',joined_at:'2026-11-15T10:00:00Z'},{user_id:'neighbor',building_id:building,apartment_id:'apt2',joined_at:'2026-10-15T10:00:00Z'}],
  apartments:Array.from({length:12},(_,i)=>({id:'apt'+(i+1),building_id:building,number:i+1})), buildings:[{id:building,name:'Çınar Apartmanı',treasury:3800}],
  messages:[{id:'m1',author_id:'neighbor',body:'Günaydın komşular! Bugün apartmanda neler var?',created_at:iso(-60000)}],
  polls:[{id:'poll1',event_id:'event',ends_at:iso(86400000),status:'open',yes_count:1,no_count:0,minimum_votes:3}],
  events:[{id:'event',title:'Asansör arızası',description:'Tamir için ortak kararımızı verelim.',cost:1200}],
  activity:[{id:'activity',description:'Yeni bir komşu taşındı.',created_at:iso(-86400000)}],
  announcements:[{id:'announcement',title:'Komşu panosu',body:'Ortak alanları temiz tutalım.'}],votes:[],blocks:[],treasury_transactions:[],
};
// Deliberately over-rich/foreign fixtures prove the social projection fails closed.
if(scenario==='social-private') {
 tables.profiles.push({id:'outsider',username:'FOREIGN_PRIVATE',email:'hidden@example.test',balance:999999});
 tables.memberships.push({user_id:'outsider',building_id:'other-building',apartment_id:'foreign-apt',joined_at:iso()});
 tables.apartments.push({id:'foreign-apt',building_id:'other-building',number:3});
}
if(scenario==='missing-profile') tables.profiles=tables.profiles.filter((p:any)=>p.id!=='neighbor');
if(scenario==='missing-joined') tables.memberships=tables.memberships.map((m:any)=>({...m,joined_at:undefined}));
Object.assign(window,{
 fixtureRemoveNeighbor:()=>{tables.profiles=tables.profiles.filter((p:any)=>p.id!=='neighbor');publish();},
 fixtureExpireTerm:()=>{tables.manager_terms=(tables.manager_terms as any[]).map(t=>({...t,ends_at:iso(200)}));publish();},
});
if(scenario==='empty'){ tables.messages=[]; tables.announcements=[]; tables.activity=[]; tables.polls=[]; tables.elections=[]; }
if(scenario==='long-chat') tables.messages=Array.from({length:16},(_,i)=>({id:'long'+i,author_id:i%2?user:'neighbor',body:i===4?'UzunMetin'.repeat(50):'Komşuların birbiriyle paylaştığı gündelik bir mesaj. '.repeat(4),created_at:iso(-i*60000)}));
if(scenario==='blocked') tables.blocks=[{blocked_id:'neighbor'}];
if(scenario==='blocked-former') tables.blocks=[{blocked_id:'former'}];
if(scenario==='long-name') tables.profiles=tables.profiles.map((p:any)=>p.id===user?{...p,username:'UzunKomsuAdi_12345678'}:p);
if(scenario==='complete'){
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 tables.wallet_transactions=[...economy.wallet_transactions,{id:'side',kind:'side_job',period_key:day,amount:25,balance_after:325,description:'Ek iş geliri',created_at:iso()}];
 tables.dues=[{...economy.dues[0],paid_at:iso()}];tables.votes=[{poll_id:'poll1',choice:true}];
}
if(scenario==='no-job') tables.wallets=[{...economy.wallets[0],job:null}];
if(scenario==='low-balance') tables.wallets=[{...economy.wallets[0],balance:20}];
let session: unknown = scenario==='visitor'?null:{user:{id:user}};
let authChanged: (event: string, value: unknown) => void = () => {};
const calls: string[] = [];
Object.assign(window,{fixtureCalls:calls});
const result=(data:unknown)=>Promise.resolve({data,error:null});
export const supabase = {
  auth:{mfa:{
    listFactors:()=>{calls.push('fixture.mfa.listFactors');return result({totp:[{id:'fixture-factor',status:'verified'}],all:[{id:'fixture-factor',status:'verified',factor_type:'totp'}]});},
    challengeAndVerify:()=>{calls.push('fixture.mfa.verify');return result({});},
  },getSession:()=>result({session}),onAuthStateChange:(callback:typeof authChanged)=>{authChanged=callback;return {data:{subscription:{unsubscribe(){}}}}},signOut:()=>{session=null;authChanged('SIGNED_OUT',null);return result(null)}},
  from:(name:string)=>{
    let mutation: 'insert' | 'delete' | undefined; let payload:any; const filters:Record<string,unknown>={};
    const query:any={select:()=>query,insert:(value:any)=>{mutation='insert';payload=value;return query;},delete:()=>{mutation='delete';return query;},order:()=>query,limit:()=>query,lt:()=>query,or:()=>query,eq:(key:string,value:unknown)=>{filters[key]=value;return query;},
      then:(yes:any,no:any)=>initialGate.then(()=>{
        if(mutation) {
          if(name!=='blocks') throw new Error('Fixture table mutation denied: '+name);
          calls.push('fixture.blocks.'+mutation);
          if(mutation==='insert') tables.blocks.push({blocked_id:payload.blocked_id});
          else tables.blocks=tables.blocks.filter((b:any)=>b.blocked_id!==filters.blocked_id);
        }
        return result(name==='polls' && !targetAvailable ? [] : tables[name]||[]);
      }).then(yes,no)};
    return query;
  },
  rpc:(name:string,args?:Record<string,unknown>)=>{
    calls.push(name);
    if(name==='staff_me') return result({roles:staff?[{code:'super_admin',title:'Süper Yönetici',scope_kind:'global',scope_id:''}]:[],permissions:[],scoped_permissions:[]});
    if(name==='settle_polls' || (name==='player_action' && args?.action==='heartbeat')) return result(null); // fixture-only no-op, no state mutation
    if(name==='dues_overview') return result([]);
    if(name==='staff_directory') return result({roles:[],permissions:[],users:[],buildings:[],assignments:[],audit:[]});
    if(name==='staff_game_overview') return result({players:[],buildings:[]});
    throw new Error('Fixture does not allow mutation RPC: '+name);
  },
  channel:()=>{const channel:any={on:(_kind:any,_filter:any,callback:any)=>{publish=callback;return channel;},subscribe:(callback:any)=>{callback('SUBSCRIBED');return channel;}};return channel;},
  removeChannel:()=>Promise.resolve(),
};
export const money=(value:number)=>new Intl.NumberFormat('tr-TR').format(value);
export const time=(value:string)=>new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));
export const errorText=(error:unknown)=>String(error);
