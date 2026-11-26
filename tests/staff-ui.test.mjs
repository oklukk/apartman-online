import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const staff=await load('src/staffAccess.ts'),nav=await load('src/navigation.ts');
const identity=(permissions=[],roles=[{code:'custom',title:'Özel',scope_kind:'global',scope_id:''}],scoped_permissions=[])=>({permissions,roles,scoped_permissions});
const visible=i=>staff.staffModules.filter(m=>staff.staffModuleVisible(i,m.key)).map(m=>m.key);
test('staff modules follow actual permissions, never ordinary elected manager or staff title alone',()=>{
 assert.deepEqual(visible(identity([],[])),[]);
 assert.deepEqual(visible(identity(['players.read','players.moderate','governance.read'])),['genel','oyuncular','secimler']);
 assert.deepEqual(visible(identity(['world.buildings.read','content.events.manage'])),['genel','roller']);
 assert.deepEqual(visible(identity(['players.read','economy.read','governance.read','staff.roles.read','staff.audit.read'])),staff.staffModules.map(m=>m.key));
 assert.deepEqual(visible(identity([], [{code:'admin',title:'Yönetici',scope_kind:'global',scope_id:''}])),['genel']);
});
test('global super includes future permissions; building role cannot manufacture global super authority',()=>{
 const role={code:'super_admin',title:'Süper Yönetici',scope_kind:'global',scope_id:''};
 assert.equal(staff.staffCan(identity([],[role]),'future.operation','other'),true);
 assert.equal(staff.staffCan(identity([],[{...role,scope_kind:'building',scope_id:'a'}]),'future.operation','a'),false);
});
test('scoped union grants module visibility but each target remains restricted',()=>{
 const i=identity([],undefined,[{building_id:'a',permissions:['economy.wallet.adjust']},{building_id:'b',permissions:['players.ban']}]);
 assert.deepEqual(visible(i),['genel','oyuncular','ekonomi']);
 assert.equal(staff.staffCan(i,'economy.wallet.adjust','a'),true);assert.equal(staff.staffCan(i,'economy.wallet.adjust','b'),false);assert.equal(staff.staffCan(i,'players.ban','a'),false);assert.equal(staff.staffCan(i,'staff.roles.read'),false);
});
test('authority signature ignores ordering but detects revocation, role and scope changes',()=>{
 const i=identity(['p.b','p.a'],undefined,[{building_id:'a',permissions:['x.b','x.a']}]);
 assert.equal(staff.staffIdentityKey(i),staff.staffIdentityKey({...i,permissions:['p.a','p.b'],scoped_permissions:[{building_id:'a',permissions:['x.a','x.b']}]}));
 assert.notEqual(staff.staffIdentityKey(i),staff.staffIdentityKey({...i,permissions:[]}));assert.notEqual(staff.staffIdentityKey(i),staff.staffIdentityKey({...i,scoped_permissions:[{building_id:'b',permissions:['x.b','x.a']}]}));
});
test('network uncertainty never claims failure or success, and safe retry wording requires retained idempotency',()=>{
 assert.match(staff.staffFailure(new Error('Failed to fetch'),true),/gerçekleşmiş olabilir/);assert.match(staff.staffFailure(new Error('Failed to fetch'),true),/aynı işlem kimliğini/);
 assert.doesNotMatch(staff.staffFailure(new Error('Failed to fetch')),/aynı işlem kimliğini/);assert.equal(staff.staffFailure(new Error('Çok faktörlü doğrulama gerekli.')),'');
});
test('staff module deep links round-trip and do not bypass authenticated membership-independent staff gate',()=>{
 for(const module of staff.staffModules){const route={page:'staff',section:module.key};assert.deepEqual(nav.parseRoute(nav.routeHref(route)),route);assert.equal(new URL(nav.routeHref(route),'https://example.test/apartman-online/').pathname,'/apartman-online/');assert.equal(nav.routeAccess(route,{authenticated:true,resident:false,staff:true}),'allowed');assert.equal(nav.routeAccess(route,{authenticated:true,resident:true,staff:false}),'forbidden');}
 assert.equal(nav.safeProfileBack('#/sistem/ekonomi'),false);assert.deepEqual(nav.parseRoute('#access_token=keep'),{page:'today'});
});
test('staff writes remain RPC-only with existing contracts, revision and request ids',()=>{
 const ops=readFileSync('src/components/StaffOperations.tsx','utf8'),control=readFileSync('src/components/StaffControlCenter.tsx','utf8'),panel=readFileSync('src/components/StaffPanel.tsx','utf8');
 for(const source of [ops,control,panel])assert.doesNotMatch(source,/\.from\(|sb_secret_|service_role|window\.confirm/);
 assert.match(ops,/operation_id: request.current.id/);assert.match(control,/operation_id: pending.id/);assert.match(control,/expected_revision: preview.revision/);
 assert.match(panel,/useMemo\(\(\)=>identity,\[signature\]\)/);
});
