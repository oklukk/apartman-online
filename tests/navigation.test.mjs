import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync('src/navigation.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const nav=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('four main destinations and nested target routes round-trip under Pages hash URLs',()=>{
  assert.deepEqual(nav.mainPages.map(p=>p.label),['Bugün','Dairem','Apartman','Komşular']);
  for(const route of [...nav.mainPages.map(p=>({page:p.page})),...nav.accountPages.map(p=>({page:p.page})),nav.targets.dues,nav.targets.sideJob,nav.targets.chat,nav.targets.poll('poll-id'),nav.targets.election('election-id')]){
    const url=new URL(nav.routeHref(route),'https://example.test/apartman-online/');
    assert.equal(url.pathname,'/apartman-online/');
    assert.deepEqual(nav.parseRoute(url.hash),route);
  }
});
test('unknown/malformed fragments fail closed without interpreting Auth callback as a route',()=>{
  for(const hash of ['#access_token=test&refresh_token=test','#error=access_denied','#/%E0%A4%A','#/unknown','#/dairem/cuzdan/a/b']) assert.deepEqual(nav.parseRoute(hash),{page:'today'});
  assert.deepEqual(nav.parseRoute('#/dairem/cuzdan/%3Cscript%3E'),{page:'home',section:'cuzdan'});
  assert.deepEqual(nav.parseRoute('#/apartman/not-real'),{page:'building'});
});
test('visitors and unjoined players cannot enter game routes; account/security stay available before membership',()=>{
  const unjoined={authenticated:true,resident:false,staff:false};
  for(const page of ['profile','settings','security']) assert.equal(nav.routeAccess({page},unjoined),'allowed');
  for(const page of ['today','home','building','neighbors']) assert.equal(nav.routeAccess({page},unjoined),'join');
  assert.equal(nav.routeAccess({page:'security'},{...unjoined,authenticated:false}),'login');
});
test('elected building manager is not staff; staff access does not require an apartment',()=>{
  assert.equal(nav.routeAccess({page:'staff'},{authenticated:true,resident:true,staff:false}),'forbidden');
  assert.equal(nav.routeAccess({page:'staff'},{authenticated:true,resident:false,staff:true}),'allowed');
});
