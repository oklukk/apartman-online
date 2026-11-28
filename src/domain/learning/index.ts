/** Draft assessment only. No XP formula, IO, account authority or game activation. */
export const STARTER_SKILLS = ['plumbing', 'business', 'basic_teaching', 'advanced_teaching'] as const
export type StarterSkill = typeof STARTER_SKILLS[number]
export type AssessmentKind = 'selection' | 'ordering' | 'matching'
export interface LearningModuleDraft {
  readonly code: string
  readonly skill: StarterSkill
  readonly ordinal: number
  readonly prerequisite: string | null
  readonly version: number
  readonly status: 'draft_only'
  readonly entryLevel: 0
  readonly titleTr: string
  readonly descriptionTr: string
  readonly goalTr: string
  readonly taskTr: string
  readonly successCriterionTr: string
  readonly successFeedbackTr: string
  readonly failureFeedbackTr: string
  readonly prompt: Readonly<Record<string, unknown>>
  readonly assessmentKind: AssessmentKind
  readonly expectedAnswer: unknown
}
export interface DraftEvaluation {
  readonly status: 'invalid' | 'failed' | 'draft_pass'
  readonly feedbackTr: string
}
const record = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const p = Object.getPrototypeOf(v) as unknown
  return p === Object.prototype || p === null
}
const token = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 2000
function answerShape(kind: unknown, value: unknown): boolean {
  if (!record(value) || Object.keys(value).length !== 1) return false
  if (kind === 'selection') return Object.hasOwn(value, 'choice') && token(value.choice)
  if (kind === 'ordering') {
    if (!Object.hasOwn(value, 'steps') || !Array.isArray(value.steps)) return false
    return value.steps.length >= 2 && value.steps.length <= 8 && value.steps.every(token) && new Set(value.steps).size === value.steps.length
  }
  if (kind === 'matching') {
    if (!Object.hasOwn(value, 'pairs') || !record(value.pairs)) return false
    const keys = Object.keys(value.pairs)
    return keys.length >= 2 && keys.length <= 8 && keys.every(token) && Object.values(value.pairs).every(token)
  }
  return false
}
export function isLearningModuleDraft(value: unknown): value is LearningModuleDraft {
  if (!record(value)) return false
  const skill = value.skill
  return typeof skill === 'string' && (STARTER_SKILLS as readonly string[]).includes(skill)
    && typeof value.code === 'string' && new RegExp('^' + skill + '\\.starter\\.[a-z][a-z0-9_]{0,39}$').test(value.code)
    && Number.isInteger(value.ordinal) && Number(value.ordinal) >= 1 && Number(value.ordinal) <= 3
    && (value.ordinal === 1 ? value.prerequisite === null : typeof value.prerequisite === 'string' && value.prerequisite.startsWith(skill + '.starter.'))
    && Number.isInteger(value.version) && Number(value.version) > 0
    && value.status === 'draft_only' && value.entryLevel === 0 && record(value.prompt)
    && typeof value.titleTr === 'string' && value.titleTr.length <= 100
    && ['titleTr', 'descriptionTr', 'goalTr', 'taskTr', 'successCriterionTr', 'successFeedbackTr', 'failureFeedbackTr'].every(k => text(value[k]))
    && answerShape(value.assessmentKind, value.expectedAnswer)
}
export function validateStarterCurriculum(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 12 || !value.every(isLearningModuleDraft)) return false
  if (new Set(value.map(v => v.code)).size !== 12) return false
  return STARTER_SKILLS.every(skill => {
    const path = value.filter(m => m.skill === skill).sort((a,b) => a.ordinal - b.ordinal)
    return path.length === 3 && path.every((m, i) => m.ordinal === i + 1 && m.prerequisite === (i ? path[i - 1].code : null))
  })
}
export function evaluateLearningDraft(module: unknown, answer: unknown): DraftEvaluation {
  if (!isLearningModuleDraft(module) || !answerShape(module.assessmentKind, answer)) {
    return { status: 'invalid', feedbackTr: 'Yanıt biçimi uygun değil. Görevde istenen seçim veya eşleştirmeyi tamamla.' }
  }
  const actual = answer as Record<string, unknown>, expected = module.expectedAnswer as Record<string, unknown>
  let pass = false
  if (module.assessmentKind === 'selection') pass = actual.choice === expected.choice
  if (module.assessmentKind === 'ordering') pass = (actual.steps as string[]).length === (expected.steps as string[]).length
    && (actual.steps as string[]).every((step, i) => step === (expected.steps as string[])[i])
  if (module.assessmentKind === 'matching') {
    const a = actual.pairs as Record<string, unknown>, e = expected.pairs as Record<string, unknown>
    pass = Object.keys(a).length === Object.keys(e).length && Object.keys(e).every(k => Object.hasOwn(a,k) && a[k] === e[k])
  }
  return { status: pass ? 'draft_pass' : 'failed', feedbackTr: pass ? module.successFeedbackTr : module.failureFeedbackTr }
}
/** A correct draft answer is NOT signed evidence or permission to award XP. */
