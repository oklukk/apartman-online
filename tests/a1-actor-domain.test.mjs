import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
const file = 'src/domain/actors/index.ts';
const source = readFileSync(file, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const domain = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const { validateInitialActorPlan: validate, validatePreferredPilot: pilot,
  validateFixedBotProfileChange: change, meetsTeachingRequirements: teaches, SKILLS } = domain;
// In-memory candidate data only. No production population manifest, UUID creation or seed.
const progress = () => Object.fromEntries(SKILLS.map(s => [s, { level: 0, xp: 0 }]));
const lecturer = (id, field, homeId) => ({ kind: 'bot', id, name: 'Fixture ' + id, homeId,
  role: 'lecturer', field, teachingFields: [field], levels: { [field]: 6, basic_teaching: 5, advanced_teaching: 3 } });
function fixture() {
  return { scope: 'pilot', populationLimit: 2, residentProfileIds: ['test-profile'],
    players: [{ kind: 'player', id: 'test-player', profileId: 'test-profile', skills: progress() }],
    bots: [lecturer('test-plumber', 'plumbing', 'test-home-1'), lecturer('test-business', 'business', 'test-home-2')],
    buildings: [{ id: 'test-building', kind: 'npc', capacity: 12 }],
    homes: Array.from({ length: 12 }, (_, i) => ({ id: 'test-home-' + (i + 1), buildingId: 'test-building', number: i + 1 })),
    activeTeachingFields: ['plumbing', 'business'], zeroLevelLearningPaths: [{ field: 'plumbing', entryLevel: 0 }, { field: 'business', entryLevel: 0 }], assignments: [] };
}
const copy = v => structuredClone(v);
const rejected = (value, code, fn = validate) => {
  const result = fn(value); assert.equal(result.ok, false);
  if (code) assert.ok(result.issues.some(i => i.code === code), JSON.stringify(result));
};
const mutate = (fn, code, check = validate) => { const p = fixture(); fn(p); rejected(p, code, check); };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

test('preferred pilot validates candidates only, with no actor result or seed defaults', () => {
  const p = fixture(); assert.deepEqual(pilot(p), { ok: true, issues: [] });
  assert.deepEqual(Object.keys(pilot(p)).sort(), ['issues', 'ok']);
  assert.deepEqual(domain.PREFERRED_PILOT.teachingFields, ['plumbing', 'business']);
  assert.equal(domain.PREFERRED_PILOT.populationLimit, 2); assert.equal(domain.PREFERRED_PILOT.homeCount, 12);
  assert.ok(Object.isFrozen(domain.PREFERRED_PILOT)); assert.ok(Object.isFrozen(domain.PREFERRED_PILOT.teachingFields));
  assert.doesNotMatch(JSON.stringify(domain.PREFERRED_PILOT), /test-player|test-plumber|test-home|profileId|homeId/);
});
test('initial residents have exactly four zero levels and zero XP; old job is never converted', () => {
  for (const skill of SKILLS) {
    for (const level of [1, 5, 10]) mutate(p => { p.players[0].skills[skill].level = level; }, 'initial-state');
    mutate(p => { p.players[0].skills[skill].xp = 1; }, 'initial-state');
    mutate(p => { delete p.players[0].skills[skill]; }, 'shape');
  }
  for (const key of ['job', 'balance', 'staffRole', 'legacyActivity']) mutate(p => { p.players[0][key] = 'technical'; }, 'shape');
});
test('levels and XP reject coercion, fractions, non-finite, negative and unsafe values', () => {
  for (const value of [-1, 11, .5, NaN, Infinity, '0', null, undefined]) mutate(p => { p.players[0].skills.plumbing.level = value; }, 'range');
  for (const value of [-1, .5, NaN, Infinity, '0', Number.MAX_SAFE_INTEGER + 1]) mutate(p => { p.players[0].skills.business.xp = value; }, 'range');
  mutate(p => { p.players[0].skills.extra = { level: 0, xp: 0 }; }, 'shape');
});
test('player identity maps existing resident references one-to-one; bots cannot take Auth/profile fields', () => {
  mutate(p => { p.players[0].profileId = 'staff-without-home'; }, 'residency');
  mutate(p => { p.players = []; }, 'residency');
  mutate(p => { p.players.push({ ...copy(p.players[0]), id: 'other' }); }, 'duplicate');
  mutate(p => { p.residentProfileIds.push('test-profile'); }, 'duplicate');
  mutate(p => { p.bots[0].id = 'test-player'; }, 'duplicate');
  mutate(p => { p.bots[0].profileId = 'test-profile'; }, 'shape');
  mutate(p => { p.players[0].kind = 'bot'; }, 'identity');
  const p = fixture(); p.players = []; p.residentProfileIds = []; assert.equal(pilot(p).ok, true);
});
test('JSON-like malformed shapes fail closed without throwing or exposing arbitrary input values', () => {
  for (const value of [null, 0, '', [], {}, { bots: [] }]) assert.doesNotThrow(() => rejected(value));
  for (const key of ['players', 'bots', 'buildings', 'homes', 'assignments', 'zeroLevelLearningPaths']) mutate(p => { p[key] = null; }, 'shape');
  mutate(p => { p.players[0].skills = []; }, 'shape');
  mutate(p => { p.bots[0] = null; }, 'shape');
  mutate(p => { p.scope = {}; }, 'shape');
  const p = fixture(); p.email = 'DO_NOT_EXPOSE_SECRET'; assert.doesNotMatch(JSON.stringify(validate(p)), /DO_NOT_EXPOSE_SECRET/);
});
test('NPC homes are separate, complete, unique and bounded by their own building capacity', () => {
  mutate(p => { p.buildings[0].kind = 'human'; }, 'housing');
  mutate(p => { p.buildings[0].capacity = 0; }, 'housing');
  mutate(p => { p.homes[0].buildingId = 'human-building'; }, 'housing');
  mutate(p => { p.homes[0].number = 13; }, 'housing');
  mutate(p => { p.homes[0].number = 2; }, 'duplicate');
  mutate(p => { p.homes[0].id = 'test-home-2'; }, 'duplicate');
  mutate(p => { p.homes.pop(); }, 'housing');
  mutate(p => { p.bots[0].homeId = 'human-home'; }, 'housing');
  mutate(p => { p.bots[1].homeId = p.bots[0].homeId; }, 'duplicate');
  mutate(p => { p.buildings.push(copy(p.buildings[0])); }, 'duplicate');
});
test('population ceilings are finite and pilot-two is not a permanent world ceiling', () => {
  for (const cap of [1, -1, Infinity, .5, '2']) mutate(p => { p.populationLimit = cap; });
  const p = fixture(); p.scope = 'world'; p.populationLimit = 3;
  p.bots.push(lecturer('test-third', 'plumbing', 'test-home-3'));
  assert.equal(validate(p).ok, true); rejected(p, 'pilot', pilot);
  const empty = { ...fixture(), scope: 'world', populationLimit: 0, residentProfileIds: [], players: [], bots: [], buildings: [], homes: [], activeTeachingFields: [], zeroLevelLearningPaths: [] };
  assert.equal(validate(empty).ok, true); rejected(empty, 'pilot', pilot);
});
test('lecturer fixed profile is area6/basic5/advanced3 and bot XP or role claims are rejected', () => {
  for (const [key, value] of [['plumbing', 5], ['plumbing', 7], ['basic_teaching', 4], ['basic_teaching', 10], ['advanced_teaching', 0], ['advanced_teaching', 5]])
    mutate(p => { p.bots[0].levels[key] = value; }, 'fixed-profile');
  mutate(p => { p.bots[0].xp = 1; }, 'shape');
  mutate(p => { p.bots[0].role = 'super_admin'; }, 'fixed-profile');
  mutate(p => { p.bots[0].levels.plumbing = '6'; }, 'range');
  mutate(p => { p.bots[0].levels.unregistered = 6; }, 'range');
  mutate(p => { p.bots[0].teachingFields = []; }, 'fixed-profile');
});
test('generic ordinary bot worker3 and operator4 standards do not change the preferred lecturer pilot', () => {
  const p = fixture(); p.activeTeachingFields = []; p.zeroLevelLearningPaths = [];
  p.bots[0] = { ...p.bots[0], role: 'worker', levels: { plumbing: 3 }, teachingFields: [] };
  p.bots[1] = { ...p.bots[1], role: 'operator', levels: { business: 4 }, teachingFields: [] };
  assert.equal(validate(p).ok, true); rejected(p, 'pilot', pilot);
  const badWorker = copy(p); badWorker.bots[0].levels.plumbing = 4; rejected(badWorker, 'fixed-profile');
  const badOperator = copy(p); badOperator.bots[1].levels.business = 5; rejected(badOperator, 'fixed-profile');
});
function ordinaryBotPlan(role, field) {
  const p = fixture(); p.activeTeachingFields = []; p.zeroLevelLearningPaths = [];
  p.bots = [{ ...p.bots[0], role, field, teachingFields: [],
    levels: role === 'worker' ? { [field]: 3 } : { business: 4, [field]: 4 } }];
  return p;
}
test('workers accept only their professional field3; operators accept only business4 and field4', () => {
  for (const role of ['worker', 'operator']) for (const field of SKILLS) {
    const p = ordinaryBotPlan(role, field);
    assert.deepEqual(validate(freeze(p)), { ok: true, issues: [] });
    assert.deepEqual(change(p.bots[0], copy(p.bots[0])), { ok: true, issues: [] });
    const reordered = copy(p.bots[0]);
    reordered.levels = Object.fromEntries(Object.entries(reordered.levels).reverse());
    assert.equal(change(p.bots[0], reordered).ok, true);
  }
});
test('workers and operators reject every unrelated known skill, even a zero-level declaration', () => {
  for (const role of ['worker', 'operator']) for (const field of SKILLS) {
    const p = ordinaryBotPlan(role, field);
    for (const extra of SKILLS.filter(s => !Object.hasOwn(p.bots[0].levels, s))) {
      for (const level of [0, 3, 4, 10]) {
        const bad = copy(p); bad.bots[0].levels[extra] = level;
        rejected(freeze(bad), 'fixed-profile');
        // An already-invalid snapshot cannot legitimize itself by remaining unchanged.
        rejected(bad.bots[0], 'fixed-profile', bot => change(bot, copy(bot)));
      }
    }
  }
});
test('ordinary bot required skills cannot be omitted or replaced by other levels or teaching claims', () => {
  for (const role of ['worker', 'operator']) for (const field of SKILLS) {
    const p = ordinaryBotPlan(role, field);
    for (const key of Object.keys(p.bots[0].levels)) {
      const missing = copy(p); delete missing.bots[0].levels[key]; rejected(missing, 'fixed-profile');
      for (const level of [0, 3, 4, 10].filter(n => n !== p.bots[0].levels[key])) {
        const bad = copy(p); bad.bots[0].levels[key] = level; rejected(bad, 'fixed-profile');
      }
    }
    const unknown = copy(p); unknown.bots[0].levels.unregistered = 10; rejected(unknown, 'range');
    const teaching = copy(p); teaching.bots[0].teachingFields = [field]; rejected(teaching, 'fixed-profile');
  }
});
test('multi-field lecturers retain all declared field6 skills including pedagogy field overrides', () => {
  const p = fixture(); p.scope = 'world'; p.bots = [p.bots[0]];
  p.activeTeachingFields = [...SKILLS];
  p.zeroLevelLearningPaths = SKILLS.map(field => ({ field, entryLevel: 0 }));
  p.bots[0].teachingFields = [...SKILLS];
  p.bots[0].levels = Object.fromEntries(SKILLS.map(field => [field, 6]));
  assert.deepEqual(validate(freeze(p)), { ok: true, issues: [] });
  for (const field of SKILLS) assert.equal(teaches(p.bots[0].levels, 'lecturer', field), true);
  const reordered = copy(p.bots[0]); reordered.teachingFields.reverse();
  assert.equal(change(p.bots[0], reordered).ok, true);
});
test('teaching pedagogy itself uses area6 priority, without turning NPCs into professors', () => {
  const p = fixture(); p.activeTeachingFields = ['basic_teaching', 'advanced_teaching'];
  p.zeroLevelLearningPaths = p.activeTeachingFields.map(field => ({ field, entryLevel: 0 }));
  p.bots[0] = { ...p.bots[0], field: 'basic_teaching', teachingFields: ['basic_teaching'], levels: { basic_teaching: 6, advanced_teaching: 3 } };
  p.bots[1] = { ...p.bots[1], field: 'advanced_teaching', teachingFields: ['advanced_teaching'], levels: { basic_teaching: 5, advanced_teaching: 6 } };
  assert.equal(validate(p).ok, true);
  assert.equal(teaches(p.bots[0].levels, 'lecturer', 'basic_teaching'), true);
  assert.equal(teaches(p.bots[1].levels, 'professor', 'advanced_teaching'), false);
  p.bots[1].levels.advanced_teaching = 3; rejected(p, 'fixed-profile');
});
test('private teacher minimums are basic5 and field5, with no advanced requirement', () => {
  assert.equal(teaches({ basic_teaching: 5, plumbing: 5 }, 'private', 'plumbing'), true);
  assert.equal(teaches({ basic_teaching: 5, advanced_teaching: 0, plumbing: 5 }, 'private', 'plumbing'), true);
  assert.equal(teaches({ basic_teaching: 4, plumbing: 5 }, 'private', 'plumbing'), false);
  assert.equal(teaches({ basic_teaching: 5, plumbing: 4 }, 'private', 'plumbing'), false);
  assert.equal(teaches({ basic_teaching: 5, advanced_teaching: 5 }, 'private', 'advanced_teaching'), true);
  assert.equal(teaches({ basic_teaching: 5, advanced_teaching: 0 }, 'private', 'advanced_teaching'), false);
});
test('university lecturer and professor keep each independent boundary and the taught-field condition', () => {
  assert.equal(teaches({ basic_teaching: 5, advanced_teaching: 3, plumbing: 6 }, 'lecturer', 'plumbing'), true);
  for (const levels of [{ basic_teaching: 4, advanced_teaching: 3, plumbing: 6 }, { basic_teaching: 5, advanced_teaching: 2, plumbing: 6 }, { basic_teaching: 5, advanced_teaching: 3, plumbing: 5 }]) assert.equal(teaches(levels, 'lecturer', 'plumbing'), false);
  assert.equal(teaches({ basic_teaching: 10, advanced_teaching: 5, plumbing: 6 }, 'professor', 'plumbing'), true);
  for (const levels of [{ basic_teaching: 9, advanced_teaching: 5, plumbing: 6 }, { basic_teaching: 10, advanced_teaching: 4, plumbing: 6 }, { basic_teaching: 10, advanced_teaching: 5, plumbing: 5 }]) assert.equal(teaches(levels, 'professor', 'plumbing'), false);
  assert.equal(teaches({ basic_teaching: 10, advanced_teaching: 5 }, 'professor', 'advanced_teaching'), false);
  assert.equal(teaches({ basic_teaching: 10, advanced_teaching: 6 }, 'professor', 'advanced_teaching'), true);
  for (const bad of [null, [], { basic_teaching: '10', advanced_teaching: 5, plumbing: 6 }, { basic_teaching: 11, plumbing: 6 }]) assert.equal(teaches(bad, 'private', 'plumbing'), false);
  assert.equal(teaches({ basic_teaching: 10, advanced_teaching: 10, plumbing: 10 }, 'super_admin', 'plumbing'), false);
});
test('each active teaching field needs real candidate coverage, not just empty housing', () => {
  mutate(p => { p.bots.pop(); }, 'coverage');
  mutate(p => { p.activeTeachingFields.push('advanced_teaching'); }, 'coverage');
  mutate(p => { p.activeTeachingFields.push('plumbing'); }, 'duplicate');
  mutate(p => { p.activeTeachingFields[0] = 'unknown'; }, 'shape');
  const p = fixture(); p.bots = [p.bots[0]]; p.bots[0].teachingFields.push('business'); p.bots[0].levels.business = 6;
  assert.equal(validate(p).ok, true); rejected(p, 'pilot', pilot);
});
test('zero-level entry paths are mandatory declarations, not fabricated courses or XP awards', () => {
  mutate(p => { p.zeroLevelLearningPaths.pop(); }, 'zero-entry');
  mutate(p => { p.zeroLevelLearningPaths[0].entryLevel = 1; }, 'zero-entry');
  mutate(p => { p.zeroLevelLearningPaths.push(copy(p.zeroLevelLearningPaths[0])); }, 'duplicate');
  mutate(p => { p.zeroLevelLearningPaths[0].field = 'basic_teaching'; }, 'zero-entry');
  const p = fixture(); validate(p); assert.equal(p.players[0].skills.plumbing.xp, 0);
});
test('assignment reuse does not duplicate bot identities, homes or fixed levels', () => {
  const p = fixture(), snapshot = copy(p.bots);
  p.assignments = [{ botId: 'test-plumber', businessId: 'test-business-A', field: 'plumbing' }, { botId: 'test-plumber', businessId: 'test-business-B', field: 'plumbing' }];
  assert.equal(pilot(p).ok, true); assert.deepEqual(p.bots, snapshot); assert.equal(p.bots.length, 2); assert.equal(p.homes.length, 12);
  const bad = copy(p); bad.assignments.push(copy(bad.assignments[0])); rejected(bad, 'duplicate');
  for (const delta of [{ botId: 'unknown' }, { field: 'business' }, { levels: { plumbing: 10 } }]) {
    const bad = copy(p); Object.assign(bad.assignments[0], delta); rejected(bad);
  }
});
test('fixed profile comparison catches renames, moves, changed optional abilities and absent-versus-zero', () => {
  const old = fixture().bots[0]; assert.equal(change(old, copy(old)).ok, true);
  for (const delta of [{ id: 'new-id' }, { name: 'New name' }, { homeId: 'test-home-3' }, { levels: { ...old.levels, business: 0 } }]) rejected(changeInput(old, delta), null, value => change(old, value));
  const shared = { ...old, teachingFields: ['plumbing', 'business'], levels: { ...old.levels, business: 6 } };
  const reordered = { ...shared, teachingFields: ['business', 'plumbing'], levels: Object.fromEntries(Object.entries(shared.levels).reverse()) };
  assert.equal(change(shared, reordered).ok, true);
  const other = { ...shared, levels: { ...shared.levels, basic_teaching: 10 } }; assert.equal(change(shared, other).ok, false);
  const withOptional = { ...old, levels: { ...old.levels, business: 0 } };
  assert.equal(change(withOptional, { ...withOptional, levels: { ...withOptional.levels, business: 1 } }).ok, false);
  assert.equal(change(null, old).ok, false);
});
function changeInput(old, delta) { return { ...copy(old), ...delta }; }
test('validation is deterministic and never mutates even deep-frozen inputs', () => {
  const p = freeze(fixture()), before = JSON.stringify(p);
  for (let i = 0; i < 5; i++) assert.deepEqual(pilot(p), { ok: true, issues: [] });
  const reordered = copy(p); reordered.bots.reverse(); reordered.players.reverse(); reordered.homes.reverse(); reordered.activeTeachingFields.reverse();
  assert.equal(pilot(reordered).ok, true); assert.equal(JSON.stringify(p), before);
  assert.equal(change(p.bots[0], p.bots[0]).ok, true); assert.equal(teaches(p.bots[0].levels, 'lecturer', 'plumbing'), true);
  const bad = copy(p); bad.players[0].skills.plumbing.xp = 1; const frozenBad = freeze(bad), badBefore = JSON.stringify(frozenBad);
  rejected(frozenBad, 'initial-state'); assert.equal(JSON.stringify(frozenBad), badBefore);
});
test('domain has no IO imports, actor factories, randomness or connection to existing game sources', () => {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const forbidden = new Set(['fetch', 'createClient', 'setInterval', 'setTimeout', 'require', 'eval', 'Function']);
  function visit(node) {
    assert.equal(ts.isImportDeclaration(node), false);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) assert.equal(forbidden.has(node.expression.text), false);
    if (ts.isPropertyAccessExpression(node)) assert.equal(['randomUUID', 'random', 'now', 'writeFile', 'readFile'].includes(node.name.text), false);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = dir + '/' + entry.name;
      if (path.startsWith('src/domain/actors')) continue;
      if (entry.isDirectory()) scan(path);
      else if (/\.tsx?$/.test(path)) assert.doesNotMatch(readFileSync(path, 'utf8'), /domain\/actors/);
    }
  }
  scan('src');
  assert.deepEqual(Object.keys(domain).sort(), ['PREFERRED_PILOT', 'SKILLS', 'meetsTeachingRequirements', 'validateFixedBotProfileChange', 'validateInitialActorPlan', 'validatePreferredPilot'].sort());
});
