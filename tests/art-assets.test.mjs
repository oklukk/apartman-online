import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = 'public/art/v2/';
const avatarFiles = readdirSync(root+'avatars').filter(f => f.endsWith('.svg'));
const files = [...readdirSync(root).filter(f => f.endsWith('.svg')), ...avatarFiles.map(f=>'avatars/'+f)];
test('24 original SVG assets are local, passive, named and lightweight', () => {
  assert.equal(files.length, 24);
  let total=0;
  for(const file of files){
    const svg=readFileSync(root+file,'utf8'); total+=statSync(root+file).size;
    assert.match(svg, /<svg[^>]+viewBox=/, file);
    assert.match(svg, /<title[^>]*>[^<]+<\/title>/, file);
    assert.doesNotMatch(svg, /<script|<foreignObject|<image|<filter|<animate|on\w+\s*=|(?:href|src)\s*=/i, file);
    assert.ok(statSync(root+file).size<40000, file+' must be under 40KB');
  }
  assert.ok(total<150000, 'SVG library budget: 150KB uncompressed');
});
test('16 portraits differ in geometry, not only color or title', () => {
  assert.equal(avatarFiles.length,16);
  const shapes=avatarFiles.map(f=>readFileSync(root+'avatars/'+f,'utf8').replace(/<title[^>]*>[\s\S]*?<\/title>/g,'').replace(/#[a-f\d]{6}/gi,'COLOR'));
  assert.equal(new Set(shapes.map(s=>createHash('sha256').update(s).digest('hex'))).size,16);
  const catalog=JSON.parse(readFileSync(root+'avatars/manifest.json','utf8'));
  assert.equal(new Set(catalog.map(a=>a.description)).size,16);
  assert.deepEqual(catalog.map(a=>a.file).sort(),avatarFiles.sort());
});
test('four floors of three apartments use bottom-up numbering and distinct hitboxes', () => {
  const a=JSON.parse(readFileSync(root+'apartment-anchors.json','utf8'));
  assert.equal(a.apartments.length,12);
  assert.deepEqual(a.apartments.map(v=>v.number),Array.from({length:12},(_,i)=>i+1));
  for(const v of a.apartments){
    assert.equal(v.floor, Math.ceil(v.number/3));
    assert.equal(v.column, (v.number-1)%3+1);
    assert.ok(v.y+v.height<842, 'Apartment excludes entrance');
    assert.ok(v.x>=0 && v.x+v.width<=1000);
    for(const other of a.apartments.filter(o=>o.number>v.number)){
      assert.ok(v.x+v.width<=other.x || other.x+other.width<=v.x || v.y+v.height<=other.y || other.y+other.height<=v.y, 'No overlapping hitboxes');
    }
  }
  assert.ok(a.apartments[0].y>a.apartments[9].y);
  assert.doesNotMatch(readFileSync(root+'apartment-facade.svg','utf8'), /<text|<tspan/);
});
test('isolated gallery has no app, network, Auth or game controls', () => {
  const html=readFileSync('tests/fixtures/art-v2/index.html','utf8');
  assert.doesNotMatch(html, /<script|https?:|supabase\.co|<button|<form/i);
  assert.match(html, /connect-src 'none'/);
  for(const file of files) assert.ok(html.includes(file),file+' shown in gallery');
});
test('v2 text pairs meet 4.5:1 on the intended broad surfaces',()=>{
  const lum=c=>c.match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  for(const [fg,bg] of [['203F3C','F7E8D0'],['4D6258','FFF9F0'],['FFF9F0','315D59'],['203F3C','EB987A'],['203F3C','9BC5AC'],['203F3C','D9AC65'],['FFF3DF','253F3B'],['C3D2C4','253F3B']]){
    const a=lum(fg),b=lum(bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${fg}/${bg}`);
  }
});
test('reviewed apartment coordinates remain byte-identical; at least six portrait geometries change',()=>{
  const baseline=JSON.parse(readFileSync('tests/fixtures/art-v2/review-baseline.json','utf8'));
  const hash=s=>createHash('sha256').update(s).digest('hex');
  assert.equal(hash(readFileSync(root+'apartment-anchors.json')),baseline.anchorsSha256);
  const changed=avatarFiles.filter(f=>hash(readFileSync(root+'avatars/'+f,'utf8').replace(/<title[^>]*>[\s\S]*?<\/title>/g,'').replace(/#[a-f\d]{6}/gi,'COLOR'))!==baseline.portraitShapes[f]);
  assert.ok(changed.length>=6, 'Six portraits must differ in shape, not just title or colors');
});
test('comparison fixture includes old/new scenes and all portraits at real chat sizes',()=>{
  const html=readFileSync('tests/fixtures/art-v2/comparison.html','utf8');
  assert.match(html,/830a5be/);
  assert.doesNotMatch(html,/<script|https?:|supabase\.co|<button|<form/i);
  for(const file of ['apartment-facade.svg','apartment-interior.svg','favicon.svg',...avatarFiles.map(f=>'avatars/'+f)]){
    assert.ok(html.includes('/before/'+file),file+' before');
    assert.ok(html.includes('/public/art/v2/'+file),file+' after');
  }
  assert.match(html,/width="32"/);assert.match(html,/width="40"/);
});
