/** Pure A1 candidate-plan validation. No persistence, ID generation, Auth or deployment authority. */
export const SKILLS = Object.freeze(['plumbing', 'business', 'basic_teaching', 'advanced_teaching'] as const);
export type Skill = typeof SKILLS[number];
export type TeachingRole = 'private' | 'lecturer' | 'professor';
export type BotRole = 'lecturer' | 'worker' | 'operator';
export type Levels = Readonly<Partial<Record<Skill, number>>>;
export type Progress = Readonly<{ level: number; xp: number }>;
export type InitialPlayer = Readonly<{
  kind: 'player'; id: string; profileId: string; skills: Readonly<Record<Skill, Progress>>;
}>;
export type FixedBot = Readonly<{
  kind: 'bot'; id: string; name: string; homeId: string; role: BotRole;
  field: Skill; levels: Levels; teachingFields: readonly Skill[];
}>;
export type NpcBuilding = Readonly<{ id: string; kind: 'npc'; capacity: number }>;
export type NpcHome = Readonly<{ id: string; buildingId: string; number: number }>;
export type BotAssignment = Readonly<{ botId: string; businessId: string; field: Skill }>;
export type InitialActorPlan = Readonly<{
  scope: 'pilot' | 'world'; populationLimit: number;
  residentProfileIds: readonly string[]; players: readonly InitialPlayer[]; bots: readonly FixedBot[];
  buildings: readonly NpcBuilding[]; homes: readonly NpcHome[];
  activeTeachingFields: readonly Skill[];
  zeroLevelLearningPaths: readonly Readonly<{ field: Skill; entryLevel: number }>[];
  assignments: readonly BotAssignment[];
}>;
export type IssueCode = 'shape' | 'identity' | 'duplicate' | 'range' | 'initial-state' |
  'residency' | 'housing' | 'population' | 'fixed-profile' | 'coverage' | 'zero-entry' |
  'assignment' | 'pilot';
export type Issue = Readonly<{ path: string; code: IssueCode; message: string }>;
export type ValidationResult = Readonly<{ ok: boolean; issues: readonly Issue[] }>;
/** Preferred design values only: this contains no actor/home identifiers or seed entries. */
export const PREFERRED_PILOT = Object.freeze({
  scope: 'pilot', populationLimit: 2, botCount: 2, buildingCount: 1, homeCount: 12,
  startingLevel: 0, startingXp: 0,
  teachingFields: Object.freeze(['plumbing', 'business'] as const),
});

type Row = Record<string, unknown>;
const row = (v: unknown): v is Row => v !== null && typeof v === 'object' &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const skill = (v: unknown): v is Skill => typeof v === 'string' && (SKILLS as readonly string[]).includes(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100 && v.trim() === v;
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const own = (r: Row, key: string) => Object.hasOwn(r, key);
const result = (issues: Issue[]): ValidationResult => ({ ok: issues.length === 0, issues });
function issue(issues: Issue[], path: string, code: IssueCode, message: string): void {
  issues.push({ path, code, message });
}
function shape(v: unknown, keys: readonly string[], path: string, issues: Issue[]): v is Row {
  if (!row(v) || Object.keys(v).some(k => !keys.includes(k)) || keys.some(k => !own(v, k))) {
    issue(issues, path, 'shape', 'Alanlar eksik veya beklenmeyen veri var.'); return false;
  }
  return true;
}
function ids(v: unknown, path: string, issues: Issue[]): v is string[] {
  if (!Array.isArray(v) || v.some(x => !id(x))) {
    issue(issues, path, 'identity', 'Geçerli referans listesi gerekli.'); return false;
  }
  if (new Set(v).size !== v.length) issue(issues, path, 'duplicate', 'Referans tekrarlanamaz.');
  return true;
}
function fields(v: unknown, path: string, issues: Issue[]): v is Skill[] {
  if (!Array.isArray(v) || v.some(x => !skill(x))) {
    issue(issues, path, 'shape', 'Bilinen yetenek alanları gerekli.'); return false;
  }
  if (new Set(v).size !== v.length) issue(issues, path, 'duplicate', 'Alan tekrarlanamaz.');
  return true;
}
function levels(v: unknown, path: string, issues: Issue[]): v is Row {
  if (!row(v) || Object.keys(v).some(k => !skill(k)) || Object.values(v).some(x => !integer(x, 0, 10))) {
    issue(issues, path, 'range', 'Yetenekler bilinen alanlarda 0–10 tamsayı olmalı.'); return false;
  }
  return true;
}

/** Qualifications only, never Auth/staff permission, lesson capacity or efficiency. */
export function meetsTeachingRequirements(input: unknown, role: TeachingRole, field: Skill): boolean {
  const errors: Issue[] = [];
  if (!skill(field) || !['private', 'lecturer', 'professor'].includes(role) || !levels(input, 'levels', errors)) return false;
  const value = (key: Skill) => own(input, key) && integer(input[key], 0, 10) ? input[key] as number : -1;
  return value('basic_teaching') >= (role === 'professor' ? 10 : 5) &&
    value(field) >= (role === 'private' ? 5 : 6) &&
    (role === 'private' || value('advanced_teaching') >= (role === 'professor' ? 5 : 3));
}

function bot(v: unknown, path: string, issues: Issue[]): v is FixedBot {
  const start = issues.length;
  if (!shape(v, ['kind', 'id', 'name', 'homeId', 'role', 'field', 'levels', 'teachingFields'], path, issues)) return false;
  if (v.kind !== 'bot' || !id(v.id) || !id(v.name) || !id(v.homeId))
    issue(issues, path, 'identity', 'Bot kimliği, profili ve ayrı konut referansı gerekli.');
  if ((v.role !== 'lecturer' && v.role !== 'worker' && v.role !== 'operator') || !skill(v.field))
    issue(issues, path, 'fixed-profile', 'Bilinen sabit meslek ve alan gerekli.');
  const fixedLevels = v.levels, taughtFields = v.teachingFields;
  if (!levels(fixedLevels, path + '.levels', issues) || !fields(taughtFields, path + '.teachingFields', issues)) return false;
  if (skill(v.field)) {
    if (v.role === 'lecturer') {
      if (!taughtFields.includes(v.field) || taughtFields.length === 0 ||
          taughtFields.some(f => fixedLevels[f] !== 6) ||
          fixedLevels.basic_teaching !== (taughtFields.includes('basic_teaching') ? 6 : 5) ||
          fixedLevels.advanced_teaching !== (taughtFields.includes('advanced_teaching') ? 6 : 3))
        issue(issues, path, 'fixed-profile', 'Bot öğretim görevlisinin alan6 ve Temel5/İleri3 sabitleri, alan istisnasıyla gerekli.');
    } else if (v.role === 'worker' || v.role === 'operator') {
      if (taughtFields.length || fixedLevels[v.field] !== (v.role === 'worker' ? 3 : 4) ||
          (v.role === 'operator' && fixedLevels.business !== 4))
        issue(issues, path, 'fixed-profile', 'Bot çalışan alan3, işletmeci ilgili alan4/İşletmecilik4 olmalı.');
    }
  }
  return issues.length === start;
}

/** Initial plans only: progressed players are an A2 concern, not reset to level/XP zero here. */
export function validateInitialActorPlan(input: unknown): ValidationResult {
  const issues: Issue[] = [];
  if (!shape(input, ['scope', 'populationLimit', 'residentProfileIds', 'players', 'bots', 'buildings',
    'homes', 'activeTeachingFields', 'zeroLevelLearningPaths', 'assignments'], 'plan', issues)) return result(issues);
  if (input.scope !== 'pilot' && input.scope !== 'world') issue(issues, 'scope', 'shape', 'Plan kapsamı gerekli.');
  if (!integer(input.populationLimit, 0)) issue(issues, 'populationLimit', 'range', 'Sonlu nüfus tavanı gerekli.');
  const residentsOk = ids(input.residentProfileIds, 'residentProfileIds', issues);
  const fieldsOk = fields(input.activeTeachingFields, 'activeTeachingFields', issues);
  for (const key of ['players', 'bots', 'buildings', 'homes', 'zeroLevelLearningPaths', 'assignments']) {
    if (!Array.isArray(input[key])) issue(issues, key, 'shape', 'Liste gerekli.');
  }
  if (issues.length) return result(issues);
  const plan = input as unknown as InitialActorPlan;
  const actorIds = new Set<string>(), profiles = new Set<string>();
  const unique = <T extends string>(value: T, set: Set<T>, path: string) => {
    if (set.has(value)) issue(issues, path, 'duplicate', 'Kimlik bir kez tanımlanmalı.');
    set.add(value);
  };
  plan.players.forEach((p: unknown, i) => {
    const path = `players[${i}]`;
    if (!shape(p, ['kind', 'id', 'profileId', 'skills'], path, issues)) return;
    if (p.kind !== 'player' || !id(p.id) || !id(p.profileId)) {
      issue(issues, path, 'identity', 'Oyuncu mevcut profile referans vermeli.'); return;
    }
    unique(p.id, actorIds, path); unique(p.profileId, profiles, path);
    if (residentsOk && !plan.residentProfileIds.includes(p.profileId))
      issue(issues, path, 'residency', 'Başlangıç yalnız belirtilen sakin referanslarına aittir.');
    if (!shape(p.skills, SKILLS, path + '.skills', issues)) return;
    for (const name of SKILLS) {
      const state = p.skills[name];
      if (!shape(state, ['level', 'xp'], path + '.skills.' + name, issues)) continue;
      if (!integer(state.level, 0, 10) || !integer(state.xp, 0))
        issue(issues, path + '.skills.' + name, 'range', 'Seviye ve XP geçerli tamsayı olmalı.');
      else if (state.level !== 0 || state.xp !== 0)
        issue(issues, path + '.skills.' + name, 'initial-state', 'İlk oyuncu planı dört alanda seviye0/XP0 ister.');
    }
  });
  if (plan.residentProfileIds.some(p => !profiles.has(p)))
    issue(issues, 'players', 'residency', 'Plan kapsamındaki her sakin için tek eşleme gerekli.');
  const buildings = new Map<string, NpcBuilding>();
  plan.buildings.forEach((b: unknown, i) => {
    const path = `buildings[${i}]`;
    if (!shape(b, ['id', 'kind', 'capacity'], path, issues)) return;
    if (!id(b.id) || b.kind !== 'npc' || !integer(b.capacity, 1)) {
      issue(issues, path, 'housing', 'Ayrı NPC binası ve pozitif tamsayı kapasite gerekli.'); return;
    }
    if (buildings.has(b.id)) issue(issues, path, 'duplicate', 'Bina tekrarlanamaz.');
    buildings.set(b.id, b as unknown as NpcBuilding);
  });
  const homes = new Map<string, NpcHome>(), numbers = new Set<string>();
  plan.homes.forEach((h: unknown, i) => {
    const path = `homes[${i}]`;
    if (!shape(h, ['id', 'buildingId', 'number'], path, issues)) return;
    if (!id(h.id) || !id(h.buildingId) || !integer(h.number, 1)) {
      issue(issues, path, 'housing', 'Konut kimliği, bina ve birim numarası gerekli.'); return;
    }
    const building = buildings.get(h.buildingId);
    if (!building || h.number > building.capacity) issue(issues, path, 'housing', 'Konut NPC binasının kapasitesinde olmalı.');
    if (homes.has(h.id)) issue(issues, path, 'duplicate', 'Konut kimliği tekrarlanamaz.');
    unique(JSON.stringify([h.buildingId, h.number]), numbers, path);
    homes.set(h.id, h as unknown as NpcHome);
  });
  for (const b of buildings.values()) {
    if ([...homes.values()].filter(h => h.buildingId === b.id).length !== b.capacity)
      issue(issues, 'homes', 'housing', 'Bina kapasitesi kadar ayrı konut tanımlanmalı.');
  }
  const bots = new Map<string, FixedBot>(), occupied = new Set<string>();
  plan.bots.forEach((b: unknown, i) => {
    const path = `bots[${i}]`;
    if (!bot(b, path, issues)) return;
    unique(b.id, actorIds, path); unique(b.homeId, occupied, path);
    if (!homes.has(b.homeId)) issue(issues, path, 'housing', 'Bot yalnız ayrı NPC konutuna bağlanmalı.');
    bots.set(b.id, b);
  });
  if (plan.bots.length > plan.populationLimit || plan.bots.length > homes.size)
    issue(issues, 'bots', 'population', 'Nüfus tavanı ve konut kapasitesi aşılamaz.');
  if (fieldsOk) for (const field of plan.activeTeachingFields) {
    if (![...bots.values()].some(b => b.role === 'lecturer' && b.teachingFields.includes(field) &&
      meetsTeachingRequirements(b.levels, 'lecturer', field)))
      issue(issues, 'activeTeachingFields', 'coverage', 'Her aktif alana nitelikli sabit öğretim görevlisi gerekli.');
  }
  const paths = new Set<Skill>();
  plan.zeroLevelLearningPaths.forEach((p: unknown, i) => {
    const path = `zeroLevelLearningPaths[${i}]`;
    if (!shape(p, ['field', 'entryLevel'], path, issues)) return;
    if (!skill(p.field) || p.entryLevel !== 0) {
      issue(issues, path, 'zero-entry', 'Başlangıç yolu seviye0 kabul etmeli.'); return;
    }
    if (!plan.activeTeachingFields.includes(p.field)) issue(issues, path, 'zero-entry', 'Yol aktif plan alanına bağlı olmalı.');
    unique(p.field, paths, path);
  });
  if (plan.activeTeachingFields.some(f => !paths.has(f)))
    issue(issues, 'zeroLevelLearningPaths', 'zero-entry', 'Her aktif alanda seviye0 giriş yolu beyanı gerekli.');
  const tasks = new Set<string>();
  plan.assignments.forEach((a: unknown, i) => {
    const path = `assignments[${i}]`;
    if (!shape(a, ['botId', 'businessId', 'field'], path, issues)) return;
    const b = id(a.botId) ? bots.get(a.botId) : undefined;
    if (!b || !id(a.businessId) || !skill(a.field) ||
        (b.role === 'lecturer' ? !b.teachingFields.includes(a.field) : b.field !== a.field)) {
      issue(issues, path, 'assignment', 'Atama mevcut sabit bot ve uygun alanı kullanmalı.'); return;
    }
    unique(JSON.stringify([a.businessId, b.role, a.field]), tasks, path);
  });
  return result(issues);
}

/** Preferred pilot is deliberately separate from the generic world-plan invariants. */
export function validatePreferredPilot(input: unknown): ValidationResult {
  const base = validateInitialActorPlan(input);
  if (!base.ok) return base;
  const p = input as InitialActorPlan;
  const fieldsMatch = p.activeTeachingFields.length === 2 && PREFERRED_PILOT.teachingFields.every(f => p.activeTeachingFields.includes(f));
  if (p.scope !== PREFERRED_PILOT.scope || p.populationLimit !== PREFERRED_PILOT.populationLimit ||
      p.bots.length !== PREFERRED_PILOT.botCount || p.buildings.length !== PREFERRED_PILOT.buildingCount ||
      p.buildings[0].capacity !== PREFERRED_PILOT.homeCount || p.homes.length !== PREFERRED_PILOT.homeCount || !fieldsMatch ||
      PREFERRED_PILOT.teachingFields.some(f => p.bots.filter(b => b.role === 'lecturer' && b.field === f &&
        b.teachingFields.length === 1 && b.teachingFields[0] === f).length !== 1))
    return result([{ path: 'plan', code: 'pilot', message: 'Tercih edilen pilot: bir NPC binası/12 konut, tavan2, iki ayrı Tesisat ve İşletmecilik öğretim görevlisi.' }]);
  return base;
}

/** Compare immutable candidate definitions, including optional skills: absent is not zero. */
export function validateFixedBotProfileChange(previous: unknown, next: unknown): ValidationResult {
  const issues: Issue[] = [];
  if (!bot(previous, 'previous', issues) || !bot(next, 'next', issues)) return result(issues);
  const signature = (b: FixedBot) => JSON.stringify([b.id, b.name, b.homeId, b.role, b.field,
    Object.entries(b.levels).sort(([a], [c]) => (a < c ? -1 : a > c ? 1 : 0)), [...b.teachingFields].sort()]);
  if (signature(previous) !== signature(next)) issue(issues, 'next', 'fixed-profile', 'Sabit bot profili atama veya ilerlemeyle değiştirilemez.');
  return result(issues);
}
