import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
const file='src/domain/learning/index.ts';
const source=readFileSync(file,'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {STARTER_SKILLS,isLearningModuleDraft,validateStarterCurriculum,evaluateLearningDraft}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const {modules}=JSON.parse(readFileSync('tests/fixtures/learning/starter-modules.json','utf8'));
const copy=v=>structuredClone(v);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function wrong(m){const a=copy(m.expectedAnswer);if(m.assessmentKind==='selection')a.choice='wrong';if(m.assessmentKind==='ordering')a.steps.reverse();if(m.assessmentKind==='matching')a.pairs[Object.keys(a.pairs)[0]]='wrong';return a;}
test('12 finite, unique and sequential Turkish drafts provide four zero-entry paths',()=>{
 assert.equal(modules.length,12);assert.equal(validateStarterCurriculum(modules),true);
 for(const skill of STARTER_SKILLS){const path=modules.filter(m=>m.skill===skill);assert.deepEqual(path.map(m=>m.ordinal),[1,2,3]);assert.ok(path.every(m=>m.entryLevel===0));assert.equal(path[0].prerequisite,null);}
 assert.equal(new Set(modules.map(m=>m.assessmentKind)).size,3);
});
test('every module evaluates a concrete correct/incorrect response and explicit feedback without XP or teacher qualification',()=>{
 for(const m of modules){assert.equal(isLearningModuleDraft(m),true);assert.deepEqual(evaluateLearningDraft(m,m.expectedAnswer),{status:'draft_pass',feedbackTr:m.successFeedbackTr});assert.deepEqual(evaluateLearningDraft(m,wrong(m)),{status:'failed',feedbackTr:m.failureFeedbackTr});assert.equal('xp'in evaluateLearningDraft(m,m.expectedAnswer),false);}
});
test('client completed/pass flags, malformed shape, duplicates and extra fields never produce success',()=>{
 for(const m of modules)for(const answer of[null,[],true,{},'completed',{completed:true},{pass:true,score:100},{...m.expectedAnswer,completed:true},{choice:9},{steps:['x','x']},{pairs:{}}])assert.notEqual(evaluateLearningDraft(m,answer).status,'draft_pass');
 const m=modules.find(m=>m.assessmentKind==='ordering');assert.equal(evaluateLearningDraft(m,{steps:[...m.expectedAnswer.steps,'extra']}).status,'failed');
 const match=modules.find(m=>m.assessmentKind==='matching');const a=copy(match.expectedAnswer);delete a.pairs[Object.keys(a.pairs)[0]];assert.notEqual(evaluateLearningDraft(match,a).status,'draft_pass');
});
test('curriculum validation rejects skipped, circular, cross-field, renamed and numeric-policy activation drafts',()=>{
 for(const alter of[p=>p.pop(),p=>p[1].prerequisite=null,p=>p[1].prerequisite=p[1].code,p=>p[1].ordinal=3,p=>p[1].skill='business',p=>p[0].code='wrong.starter.code',p=>p[0].entryLevel=1,p=>p[0].status='active',p=>p[0].version=0]){const p=copy(modules);alter(p);assert.equal(validateStarterCurriculum(p),false);}
});
test('answer ordering matters but matching object property order does not; inputs stay frozen',()=>{
 const fixed=freeze(copy(modules));const before=JSON.stringify(fixed);
 for(const m of fixed){const answer=copy(m.expectedAnswer);if(m.assessmentKind==='matching')answer.pairs=Object.fromEntries(Object.entries(answer.pairs).reverse());assert.equal(evaluateLearningDraft(m,freeze(answer)).status,'draft_pass');}
 assert.equal(JSON.stringify(fixed),before);assert.equal(validateStarterCurriculum([...fixed].reverse()),true);
});
test('the pure grader cannot grant account authority or be imported by the existing application',()=>{
 assert.doesNotMatch(source,/\b(import|fetch|createClient|setInterval|setTimeout|randomUUID)\b/);
 function scan(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(f.startsWith('src/domain/learning'))continue;if(e.isDirectory())scan(f);else if(/\.tsx?$/.test(f))assert.doesNotMatch(readFileSync(f,'utf8'),/domain\/learning/);}}scan('src');
 assert.equal(isLearningModuleDraft({...modules[0],expectedAnswer:{completed:true}}),false);
 assert.equal(evaluateLearningDraft(null,{}).status,'invalid');
});
