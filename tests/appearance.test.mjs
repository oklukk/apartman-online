import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const {normalizeTheme,normalizeAppearance,readAppearance,saveAppearance,appearanceDefaults,themeKey,appearanceKey}=await load('src/appearance.ts');
const nav=await load('src/navigation.ts');
const storage=(entries={})=>{const data=new Map(Object.entries(entries));return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};};
test('appearance defaults validate each enum without treating arbitrary truthy data as a preference',()=>{
 assert.equal(normalizeTheme('dark'),'dark');assert.equal(normalizeTheme('light'),'light');
 for(const value of [null,'unknown',{},true]) assert.equal(normalizeTheme(value),'system');
 assert.deepEqual(normalizeAppearance(null),appearanceDefaults);
 assert.deepEqual(normalizeAppearance({textSize:'huge',density:'tiny',reduceMotion:'true',staff:true}),appearanceDefaults);
 assert.deepEqual(normalizeAppearance({textSize:'large',density:'compact',reduceMotion:true}),{textSize:'large',density:'compact',reduceMotion:true});
});
test('existing theme survives and device preferences round-trip; reset only writes the two appearance keys',()=>{
 const s=storage({[themeKey]:'dark','sb-fixture-auth-token':'untouched','unrelated':'keep'});
 assert.equal(readAppearance(s).theme,'dark');
 const prefs={textSize:'large',density:'compact',reduceMotion:true};
 assert.equal(saveAppearance(s,'dark',prefs),true);assert.deepEqual(readAppearance(s),{theme:'dark',appearance:prefs});
 saveAppearance(s,'system',appearanceDefaults);
 assert.deepEqual(readAppearance(s),{theme:'system',appearance:appearanceDefaults});
 assert.equal(s.getItem('sb-fixture-auth-token'),'untouched');assert.equal(s.getItem('unrelated'),'keep');assert.equal(s.data.size,4);
});
test('malformed, unsupported or denied storage cannot prevent rendering account or login screens',()=>{
 for(const raw of ['{','null','false','[]','{"version":2,"textSize":"large"}']) assert.deepEqual(readAppearance(storage({[appearanceKey]:raw})).appearance,appearanceDefaults);
 const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
 assert.deepEqual(readAppearance(denied),{theme:'system',appearance:appearanceDefaults});assert.equal(saveAppearance(denied,'dark',appearanceDefaults),false);
});
test('only allowlisted display fields are persisted, without social, auth or role data',()=>{
 const s=storage();saveAppearance(s,'dark',{...appearanceDefaults,avatar_id:'not-supported',email:'private@example.test',roles:['super']});
 assert.deepEqual(JSON.parse(s.getItem(appearanceKey)),{version:1,...appearanceDefaults});assert.deepEqual([...s.data.keys()].sort(),[appearanceKey,themeKey].sort());
});
test('settings deep links and return context round-trip within Pages without opening staff routes',()=>{
 for(const section of ['gorunum','gizlilik']) {
  const route={page:'settings',section};const url=new URL(nav.routeHref(route),'https://example.test/apartman-online/');assert.equal(url.pathname,'/apartman-online/');assert.deepEqual(nav.parseRoute(url.hash),route);
  const social={page:'resident',userId:'neighbor',from:nav.routeHref(route)};assert.deepEqual(nav.parseRoute(nav.routeHref(social)),social);
 }
 for(const access of [{authenticated:true,resident:false,staff:false},{authenticated:true,resident:false,staff:true},{authenticated:true,resident:true,staff:false}]) {
  assert.equal(nav.routeAccess({page:'settings',section:'gizlilik'},access),'allowed');assert.equal(nav.routeAccess({page:'security'},access),'allowed');
 }
 assert.equal(nav.routeAccess({page:'settings'},{authenticated:false,resident:false,staff:false}),'login');
 assert.equal(nav.safeProfileBack('#/sistem'),false);assert.equal(nav.safeProfileBack('https://outside.test'),false);
});
