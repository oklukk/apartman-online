import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync('src/styles/player-screens.css','utf8');
const block=selector=>{const a=css.indexOf(selector);assert.ok(a>=0);return Object.fromEntries([...css.slice(css.indexOf('{',a),css.indexOf('}',a)).matchAll(/--([\w-]+):\s*(#[a-f\d]{6})/gi)].map(([,k,v])=>[k,v]));};
const light=block('.player-shell {'),dark=block(':root[data-theme="dark"] .player-shell {');
const lum=hex=>hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
for(const [name,t] of [['light',{...light,'on-accent':'#ffffff'}],['dark',{...dark,'on-accent':'#14271c'}]]){
 test(`player ${name} text, action and input colors retain accessible contrast`,()=>{
  for(const [a,b] of [['ink','bg'],['ink','panel'],['muted','panel'],['muted','bg'],['ink','soft'],['on-accent','accent']])assert.ok(ratio(t[a],t[b])>=4.5,`${a}/${b}`);
  assert.ok(ratio(t['control-line'],t.panel)>=3,'input boundary');
 });
}
test('system dark follows the same player palette',()=>{
 assert.deepEqual(block(':root:not([data-theme="light"]):not([data-theme="dark"]) .player-shell {'),dark);
});
