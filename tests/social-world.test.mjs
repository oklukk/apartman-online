import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const {avatarIdFor,publicApartments,joinedMonth}=await load('src/social.ts');
const nav=await load('src/navigation.ts');
const anchors=JSON.parse(readFileSync('public/art/v2/apartment-anchors.json'));
const building={id:'b',name:'Çınar Apartmanı'};
const apartments=Array.from({length:12},(_,i)=>({id:'a'+i,building_id:'b',number:i+1}));
const profiles=[{id:'self',username:'Deniz',email:'NEVER',balance:4000},{id:'neighbor',username:'Ece',staff_roles:['super']}];
const members=[{user_id:'self',building_id:'b',apartment_id:'a0',joined_at:'2026-10-31T22:00:00Z'},{user_id:'neighbor',building_id:'b',apartment_id:'a1'}];
const now=Date.parse('2026-11-25T10:00:00Z');
const term={id:'t',user_id:'self',building_id:'b',starts_at:'2026-11-24T00:00:00Z',ends_at:'2026-11-26T00:00:00Z'};
const project=(p=profiles,m=members,a=apartments,t=[term],date=now)=>publicApartments('self',building,p,m,a,t,date);
test('stable canonical avatar assignment uses all 16 portraits, independent of resident/manifest order',()=>{
 const ids=Array.from({length:256},(_,i)=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0'));
 const assigned=Object.fromEntries(ids.map(id=>[id,avatarIdFor(id)]));
 assert.equal(new Set(Object.values(assigned)).size,16);
 for(const id of ids.toReversed()) assert.equal(avatarIdFor(id),assigned[id]);
 assert.equal(avatarIdFor('ABC-123'),avatarIdFor('abc-123'));
 for(const invalid of ['', null, undefined, '../x', '<img>', 'a'.repeat(101)]) assert.equal(avatarIdFor(invalid),null);
});
test('all twelve anchor floors/columns and nonoverlapping geometry match the preserved 4x3 facade',()=>{
 assert.deepEqual(anchors.viewBox,[0,0,1000,1100]);
 anchors.apartments.forEach((a,i)=>{assert.equal(a.number,i+1);assert.equal(a.floor,Math.ceil((i+1)/3));assert.equal(a.column,i%3+1);assert.equal(a.x,208+(i%3)*205);assert.equal(a.y,671-Math.floor(i/3)*151);assert.equal(a.width,166);assert.equal(a.height,139);});
 for(const a of anchors.apartments) for(const b of anchors.apartments) if(a!==b) assert.ok(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y);
});
test('occupancy, self and valid manager are independent; expired, future, voided and foreign terms cannot badge',()=>{
 const units=project();assert.equal(units.length,12);assert.equal(units[0].resident.userId,'self');assert.equal(units[0].resident.isManager,true);assert.equal(units[1].resident.isManager,false);assert.equal(units[11].status,'empty');assert.equal(units[11].resident,undefined);
 for(const t of [{...term,ends_at:term.starts_at},{...term,starts_at:'2026-11-26'},{...term,voided:true},{...term,building_id:'other'}]) assert.equal(project(profiles,members,apartments,[t])[0].resident.isManager,false);
 assert.equal(project(profiles,members,apartments,[term],Date.parse(term.ends_at))[0].resident.isManager,false);
});
test('public projection allowlists identity only, scopes viewer/member/apartment, and fails closed for missing records',()=>{
 const person=project()[0].resident;
 assert.deepEqual(Object.keys(person).sort(),['userId','username','buildingId','buildingName','apartmentNumber','floor','joinedMonth','isManager'].sort());
 assert.doesNotMatch(JSON.stringify(project()),/NEVER|staff_roles|balance|email/);
 assert.equal(publicApartments('outsider',building,profiles,members,apartments,[term]).length,0);
 const foreign=[...members,{user_id:'foreign',building_id:'other',apartment_id:'a2'}];
 assert.equal(project([...profiles,{id:'foreign',username:'PRIVATE'}],foreign)[2].status,'empty');
 assert.equal(project([],members)[0].status,'unavailable');
 assert.equal(project([{id:'self'}],members)[0].status,'unavailable');
 assert.equal(project(profiles,members,[])[0].status,'unavailable');
 assert.equal(project(profiles,[members[0]])[1].status,'empty');
});
test('joined month uses actual membership timestamp and Istanbul month; missing/invalid stays absent',()=>{
 assert.equal(joinedMonth('2026-10-31T22:00:00Z'),'Kasım 2026');assert.equal(joinedMonth(),undefined);assert.equal(joinedMonth('invalid'),undefined);assert.equal(project()[1].resident.joinedMonth,undefined);
});
test('social profile hash routes round-trip, preserve Pages path and safe context, require membership, reject external returns',()=>{
 for(const from of ['#/komsular/sohbet','#/apartman/kesfet/daire-02','#/profilim']) {
  const route={page:'resident',userId:'neighbor',from};const url=new URL(nav.routeHref(route),'https://example.test/apartman-online/');assert.equal(url.pathname,'/apartman-online/');assert.deepEqual(nav.parseRoute(url.hash),route);
 }
 assert.equal(nav.routeAccess({page:'resident'},{authenticated:true,resident:false,staff:true}),'join');
 for(const from of ['https://evil.test','javascript:alert(1)','#/sistem','#/komsu/other']) assert.equal(nav.safeProfileBack(from),false);
 assert.deepEqual(nav.parseRoute('#/komsu/neighbor?from=https%3A%2F%2Fevil.test'),{page:'resident',userId:'neighbor'});
 assert.deepEqual(nav.parseRoute('#/komsu/../secret'),{page:'resident'});
 assert.deepEqual(nav.parseRoute('#access_token=keep&refresh_token=keep'),{page:'today'});
});
