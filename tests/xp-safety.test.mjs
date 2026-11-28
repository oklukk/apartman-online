import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('_a22b_approved_xp_progression.sql'));
assert.equal(files.length,1);
const sql=readFileSync('supabase/migrations/'+files[0],'utf8');
test('XP migration is inert: no public RPC, production activation, actor creation, content seed or cron',()=>{
 assert.doesNotMatch(sql,/create(?: or replace)? function public\.|security definer|cron\.(schedule|unschedule)/i);
 const topLevel=sql.replace(/\bas\s+\$\$[\s\S]*?\$\$;/g,'as $$<body>$$;');
 assert.doesNotMatch(topLevel,/insert into (?:public\.|private\.(?:actors|actor_skills|learning_modules|learning_module_drafts|xp_verified_completions))\b/i);
 assert.match(sql,/insert into private\.xp_runtime values\(true,'a22b_approved_20261128',1,'disabled'\)/);
 assert.match(sql,/current_database\(\)<>'apartman_a22b_xp'/);
 assert.doesNotMatch(sql,/set_config\(|request\.jwt|user_metadata/);
});
test('closed A1 receipt transition preserves the exact existing NPC consistency branch',()=>{
 const previous=readFileSync('supabase/migrations/20261128071343_a2_npc_catalog_migration.sql','utf8');
 const botBranch=s=>s.slice(s.indexOf(' select * into b from private.bot_profiles where actor_id=target;'),s.indexOf('end $$;',s.indexOf(' select * into b from private.bot_profiles where actor_id=target;')));
 assert.ok(botBranch(sql).length>1000);assert.equal(botBranch(sql),botBranch(previous));
 assert.match(sql,/new\.level<>0 or new\.xp<>0/);assert.match(sql,/candidate_xp<>total/);
 assert.doesNotMatch(sql,/drop (?:table|type)|disable trigger/i);
});
test('disposable XP test cannot read hosted connection config or change production application imports',()=>{
 const suite=readFileSync('tests/xp-progression.mjs','utf8');
 assert.match(suite,/127\.0\.0\.1:55432\/postgres/);assert.doesNotMatch(suite,/process\.env|local-status|createClient|https:\/\//);
 function scan(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())scan(p);else if(/\.tsx?$/.test(p))assert.doesNotMatch(readFileSync(p,'utf8'),/award_verified_xp|record_test_xp_completion|xp_award_receipts/);}}
 scan('src');
});
