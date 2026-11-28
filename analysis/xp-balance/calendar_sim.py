"""Finite-content calendar research, not a game service. Pure memory; no network/DB.

Uses the existing offline XP arithmetic, never production imports. Two qualified
pilot instructors have separate, finite per-field admission budgets. Expert study
is a HYPOTHETICAL separately validated self-directed route, not teaching by level6 NPCs.
"""
from __future__ import annotations
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from simulate import Ledger, SKILLS, TURKEY, thresholds

FIELDS = ('plumbing', 'business')
REASONS = ('no_time', 'prerequisite', 'daily_right', 'weekly_right', 'instructor_capacity',
           'calendar_closed', 'expert_unavailable', 'content_exhausted', 'retry_limit', 'xp_cap', 'phase_ceiling', 'finished')


def turkey_day(stamp: datetime) -> date:
    if stamp.tzinfo is None:
        raise ValueError('Aware synthetic server timestamp required')
    return stamp.astimezone(TURKEY).date()


def qualified_instructor(spec: dict, taught_level=6) -> bool:
    return spec.get('field_level', 0) >= max(6, taught_level) and spec.get('basic_teaching', 0) >= 5 and spec.get('advanced_teaching', 0) >= 3


def monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


@dataclass(frozen=True)
class Offering:
    key: str
    opens: date
    closes: date  # exclusive; local midnight boundary

    def contains(self, day: date) -> bool:
        return self.opens <= day < self.closes


def offerings(config: dict, schedule: dict, field: str, kind: str, today: date,
              always_open=False, short_window=False) -> list[Offering]:
    prefix = 'course' if kind == 'middle' else kind
    window = 1 if short_window else schedule[prefix + '_window_days']
    reference = date.fromisoformat(config['reference_date'])
    result = []
    for ago in range(window - 1, -1, -1):
        opens = today - timedelta(days=ago)
        week = (monday(opens) - monday(reference)).days // 7
        # Business instructor timetable shifted by one day: distinct, not a third instructor.
        weekdays = schedule[prefix + '_weekdays']
        if prefix == 'course' and field == 'business':
            weekdays = [(n + 1) % 7 for n in weekdays]
        available = always_open or (week >= 0 and week % schedule[prefix + '_period_weeks'] == 0 and opens.weekday() in weekdays)
        if opens >= reference and available:
            result.append(Offering(f'{field}:{kind}:{opens.isoformat()}', opens, opens + timedelta(days=window)))
    return result


@dataclass
class Case:
    name: str = 'regular'
    targets: tuple = ('plumbing',)
    attendance: str = 'daily'
    failure_every: int = 0
    always_open: bool = False
    unlimited_capacity: bool = False
    no_rights: bool = False
    no_gates: bool = False
    no_xp_caps: bool = False
    no_makeup: bool = False
    expert_available: bool = True
    cohort: int | None = None
    start_offset: int = 0
    capacity_multiplier: int = 1
    needs_per_week: int | None = None
    starter_minutes: int | None = None
    starter_xp: int | None = None


class Learner:
    def __init__(self, key: str, minutes: int, targets: tuple, base: dict, cfg: dict, case: Case):
        self.key, self.minutes, self.targets, self.case = key, minutes, targets, case
        self.limits = thresholds(base['models']['B'])
        self.rewards = base['models']['B']['xp']
        caps = base['models']['B']['caps']
        self.ledger = Ledger(self.limits[-1], None if case.no_xp_caps else caps['general'], None if case.no_xp_caps else caps['skill'])
        self.level = {s: 0 for s in SKILLS}
        self.completed: set[str] = set()
        self.work: dict[str, int] = defaultdict(int)
        self.evidence: Counter = Counter()
        self.attempts: Counter = Counter()
        self.daily: Counter = Counter()
        self.weekly: Counter = Counter()
        self.enrolled: dict[str, Offering] = {}
        self.active_days = self.study_minutes = self.day_minutes = self.practice_attempts = 0
        self.phase_lost = self.potential = self.failed = 0
        self.level_hits = {}
        self.reasons: Counter = Counter()
        self.events, self.history = [], []
        self.day = date.fromisoformat(cfg['reference_date'])
        self.started = self.day
        self.day_index = 0
        self.retry_counts: Counter = Counter()

    def active(self, index: int) -> bool:
        if index <= self.case.start_offset:
            return False
        if self.case.attendance == 'irregular':
            return (index - 1) % 7 in (0, 2, 5)
        if self.case.attendance == 'break14':
            return not 8 <= index <= 21
        return True

    def stage(self, field: str) -> str:
        return 'starter' if self.level[field] < 3 else ('middle' if self.level[field] < 6 else 'expert')

    def mark_reason(self, reasons: set, reason: str) -> None:
        reasons.add(reason)

    def update(self, cfg: dict):
        for field in self.targets:
            while self.level[field] < 10:
                nxt = self.level[field] + 1
                if self.ledger.xp[field] < self.limits[nxt]:
                    break
                rule = {} if self.case.no_gates else cfg['gates'].get(str(nxt), {})
                if not all(self.evidence[field, kind if kind != 'project_minutes' else f'project{nxt}'] >= count
                           for kind, count in rule.items()):
                    break
                self.level[field] = nxt
                if nxt in (3, 5, 7, 10):
                    self.level_hits[field, nxt] = {'day': self.day_index, 'active_days': self.active_days,
                                                   'minutes': self.study_minutes}

    def complete(self, cfg: dict, field: str, content_id: str, kind: str, duration: int, reward: int,
                 stage: str, *, can_fail=True, evidence_kind: str | None = None) -> bool:
        """Synthetic verified outcome; changing offering/attempt never changes content identity."""
        if content_id in self.completed:
            return False
        self.attempts[content_id] += 1
        self.practice_attempts += int(can_fail)
        success = not can_fail or not self.case.failure_every or self.practice_attempts % self.case.failure_every != 0
        if not success:
            self.failed += 1
            self.retry_counts[monday(self.day), field] += 1
        else:
            self.completed.add(content_id)
            self.evidence[field, evidence_kind or kind] += duration if kind == 'project' else 1
            if kind == 'practice':
                self.evidence[field, stage + '_practice'] += 1
            ceiling = self.limits[cfg['stage_ceiling_levels'][('starter', 'middle', 'expert').index(stage)]]
            eligible = max(0, min(reward, ceiling - self.ledger.xp[field]))
            self.potential += reward
            self.phase_lost += reward - eligible
            stamp = datetime.combine(self.day, time(9), TURKEY) + timedelta(minutes=self.day_minutes)
            self.ledger.award('synthetic-calendar:' + self.key + ':' + content_id, {field: eligible}, stamp)
        self.update(cfg)
        if self.day_index <= 14 and self.key == 'learner0':
            self.events.append({'day': self.day_index, 'date': self.day.isoformat(), 'field': field, 'kind': kind,
                                'content_id': content_id, 'attempt': self.attempts[content_id], 'success': success,
                                'reward_candidate': reward if success else 0, 'level': self.level[field]})
        return success


class CalendarSimulation:
    def __init__(self, base: dict, cfg: dict, calendar: str, minutes: int, case: Case | None = None):
        self.base, self.cfg, self.calendar = base, cfg, calendar
        self.schedule = cfg['calendars'][calendar]
        self.case = case or Case()
        n = self.case.cohort if self.case.cohort is not None else cfg['cohort_size']
        self.learners = [Learner('learner0', minutes, self.case.targets, base, cfg, self.case)]
        for i in range(1, n):
            background = Case('background', targets=(FIELDS[i % 2],))
            self.learners.append(Learner(f'learner{i}', cfg['background_minutes'], background.targets, base, cfg, background))
        self.probe = self.learners[0]
        self.session_starts: Counter = Counter()
        self.teacher_starts: Counter = Counter()
        self.project_starts: Counter = Counter()
        self.date = date.fromisoformat(cfg['reference_date'])
        self.index = 0

    def course_entry(self, p: Learner, field: str, kind: str, content: str, reasons: set) -> bool:
        if content in p.completed:
            reasons.add('content_exhausted'); return False
        required_level, credential = (3, 'starter') if kind == 'middle' else (6, 'middle')
        if p.level[field] < required_level or (not p.case.no_gates and p.evidence[field, credential] < 3):
            reasons.add('prerequisite'); return False
        if kind == 'middle' and not qualified_instructor(self.cfg['pilot_instructors'].get(field, {})):
            reasons.add('instructor_unqualified'); return False
        if kind == 'expert' and not p.case.expert_available:
            reasons.add('expert_unavailable'); return False
        existing = p.enrolled.get(content)
        if existing and existing.contains(self.date):
            return True
        week = monday(self.date)
        if not p.case.no_rights:
            if p.daily[field, 'course_start'] >= self.schedule['course_daily']:
                reasons.add('daily_right'); return False
            if p.weekly[week, field, 'course_start'] >= self.schedule['course_weekly']:
                reasons.add('weekly_right'); return False
        slots = offerings(self.cfg, self.schedule, field, kind, self.date, p.case.always_open, p.case.no_makeup)
        if not slots:
            reasons.add('calendar_closed'); return False
        for slot in slots:
            prefix = 'course' if kind == 'middle' else 'expert'
            seats = self.schedule['seats_per_session'] if kind == 'middle' else self.schedule['expert_seats']
            weekly = self.schedule['instructor_weekly_starts'] if kind == 'middle' else self.schedule['expert_weekly_starts']
            seats *= self.case.capacity_multiplier
            weekly *= self.case.capacity_multiplier
            if not p.case.unlimited_capacity and (self.session_starts[slot.key] >= seats or
                    self.teacher_starts[week, field, kind] >= weekly):
                continue
            self.session_starts[slot.key] += 1
            self.teacher_starts[week, field, kind] += 1
            p.enrolled[content] = slot
            p.daily[field, 'course_start'] += 1
            p.weekly[week, field, 'course_start'] += 1
            return True
        reasons.add('instructor_capacity')
        return False

    def spend(self, p: Learner, field: str, content: str, kind: str, total: int, xp: int, stage: str,
              remaining: int, *, evidence_kind: str | None = None, can_fail=True) -> int:
        chunk = min(remaining, total - p.work[content]) // 5 * 5
        if not chunk:
            return 0
        p.work[content] += chunk
        p.study_minutes += chunk
        p.day_minutes += chunk
        if p.work[content] >= total:
            ok = p.complete(self.cfg, field, content, kind, total, xp, stage, can_fail=can_fail, evidence_kind=evidence_kind)
            if not ok:
                p.work[content] = 0  # retry same content; prior work time was spent, no XP
        return chunk

    def blocked_retry(self, p: Learner, field: str, reasons: set) -> bool:
        if p.retry_counts[monday(self.date), field] >= self.schedule['retry_weekly']:
            reasons.add('retry_limit'); return True
        return False

    def task(self, p: Learner, field: str, remaining: int, reasons: set) -> int:
        if p.level[field] >= 10:
            reasons.add('finished'); return 0
        if remaining < 5:
            reasons.add('no_time'); return 0
        stage = p.stage(field)
        if stage == 'expert' and not p.case.expert_available:
            reasons.add('expert_unavailable'); return 0
        content_cfg = self.cfg['content']
        # Fixed tutorial path starts at zero; never consumes NPC instruction seats.
        intro = f'{field}:intro'
        if intro not in p.completed:
            return self.spend(p, field, intro, 'intro', content_cfg['intro_minutes'], p.rewards['intro'], stage, remaining, can_fail=False)
        module_max = content_cfg[stage + '_modules']
        module_index = next((i for i in range(1, module_max + 1) if f'{field}:{stage}:module{i}' not in p.completed), None)
        if module_index is not None:
            module_id = f'{field}:{stage}:module{module_index}'
            # Ordered unique modules: prior module completion, stage credential/level checked above.
            if stage == 'starter':
                if p.daily[field, 'starter'] < 1 and not self.blocked_retry(p, field, reasons):
                    before = p.evidence[field, 'starter']
                    used = self.spend(p, field, module_id, 'starter', p.case.starter_minutes or content_cfg['module_minutes'], p.case.starter_xp or p.rewards['course'], stage, remaining)
                    if p.evidence[field, 'starter'] > before or p.work[module_id] == 0:
                        p.daily[field, 'starter'] += 1
                    if used: return used
                else: reasons.add('daily_right')
            elif not self.blocked_retry(p, field, reasons) and self.course_entry(p, field, stage, module_id, reasons):
                used = self.spend(p, field, module_id, stage, content_cfg['module_minutes'], p.rewards['course'], stage, remaining)
                if used: return used
        else:
            reasons.add('content_exhausted')
        # Project work is chunkable; unlock only after preceding level. No XP for open/click.
        nxt = p.level[field] + 1
        rule = {} if p.case.no_gates else self.cfg['gates'].get(str(nxt), {})
        project_key = f'project{nxt}'
        project_id = f'{field}:expert:{project_key}'
        if rule.get('project_minutes') and project_id not in p.completed:
            if not p.case.expert_available:
                reasons.add('expert_unavailable')
            elif offerings(self.cfg, self.schedule, field, 'project', self.date, p.case.always_open, p.case.no_makeup):
                if not self.blocked_retry(p, field, reasons):
                    used = self.spend(p, field, project_id, 'project', rule['project_minutes'], 0, stage, remaining,
                                      evidence_kind=project_key)
                    # Evidence for project gates is successful TOTAL minutes, not click or chunks.
                    if project_id in p.completed:
                        p.evidence[field, project_key] = rule['project_minutes']
                        p.update(self.cfg)
                    if used: return used
            else: reasons.add('calendar_closed')
        # Finite chapters; no re-read XP. Every phase has an explicit fixed content list.
        count = content_cfg['books_by_stage'][('starter', 'middle', 'expert').index(stage)]
        for i in range(1, count + 1):
            book = f'{field}:{stage}:book{i}'
            if book not in p.completed and p.daily[field, 'book'] < 1:
                before = book in p.completed
                used = self.spend(p, field, book, 'book', content_cfg['book_minutes'], p.rewards['book'], stage, remaining, can_fail=False)
                if not before and book in p.completed: p.daily[field, 'book'] += 1
                if used: return used
        # Real distinct demand is a hypothesis: finite released need pool with stable weekly IDs.
        week = monday(self.date)
        if not p.case.no_rights:
            if p.daily[field, 'practice'] >= self.schedule['practice_daily']:
                reasons.add('daily_right'); return 0
            if p.weekly[week, field, 'practice'] >= self.schedule['practice_weekly']:
                reasons.add('weekly_right'); return 0
        if self.blocked_retry(p, field, reasons): return 0
        window = self.schedule['practice_window_days']
        for age in range(window - 1, -1, -1):
            release = self.date - timedelta(days=age)
            if release < date.fromisoformat(self.cfg['reference_date']): continue
            # Weekly pool distributed across broad daily windows, not minted per login.
            day_in_week = release.weekday()
            pool = p.case.needs_per_week if p.case.needs_per_week is not None else self.schedule['practice_pool_weekly']
            count = pool // 7 + int(day_in_week < pool % 7)
            for slot in range(count):
                task_id = f'{p.key}:{field}:need:{release.isoformat()}:{slot}'
                if task_id in p.completed: continue
                if remaining < content_cfg['practice_minutes']:
                    reasons.add('no_time'); return 0
                p.daily[field, 'practice'] += 1
                p.weekly[week, field, 'practice'] += 1
                return self.spend(p, field, task_id, 'practice', content_cfg['practice_minutes'], p.rewards['practice'], stage, remaining)
        reasons.add('calendar_closed')
        return 0

    def run(self, days: int, record_until=180):
        reference = date.fromisoformat(self.cfg['reference_date'])
        for index in range(1, days + 1):
            self.index = index
            self.date = reference + timedelta(days=index - 1)
            offset = (index - 1) % len(self.learners)
            order = self.learners[offset:] + self.learners[:offset]
            for p in order:
                p.day, p.day_index, p.day_minutes = self.date, index, 0
                p.daily.clear()
                reasons = set()
                active = p.active(index)
                before_xp = p.ledger.credited
                before_phase = p.phase_lost
                before_cap = p.ledger.cap_lost
                if active:
                    p.active_days += 1
                    unfinished = [f for f in p.targets if p.level[f] < 10]
                    # Whole-day alternation avoids tiny unusable slices for15min dual profiles.
                    if unfinished and len(unfinished) > 1 and p.minutes < 30:
                        chosen = [unfinished[(p.active_days - 1) % len(unfinished)]]
                    else: chosen = unfinished
                    for field in chosen:
                        budget = p.minutes // len(chosen) // 5 * 5
                        remaining = budget
                        while remaining >= 5:
                            used = self.task(p, field, remaining, reasons)
                            if not used: break
                            remaining -= used
                        if p.level[field] < 10:
                            rule = self.cfg['gates'].get(str(p.level[field] + 1), {})
                            if not p.case.no_gates and p.ledger.xp[field] >= p.limits[p.level[field] + 1] and rule:
                                reasons.add('prerequisite')
                    if p.phase_lost > before_phase: reasons.add('phase_ceiling')
                    if p.ledger.cap_lost > before_cap: reasons.add('xp_cap')
                    if not unfinished: reasons.add('finished')
                if p is self.probe:
                    if index <= record_until:
                        for reason in reasons: p.reasons[reason] += 1
                    if index <= record_until and active and p.ledger.credited == before_xp and not all(p.level[f] == 10 for f in p.targets):
                        p.reasons['zero_xp_active_days'] += 1
                        if p.day_minutes == 0: p.reasons['no_work_active_days'] += 1
                    if index <= record_until:
                        idle = max(0, p.minutes - p.day_minutes) if active and not all(p.level[f] == 10 for f in p.targets) else 0
                        priority = ('expert_unavailable', 'instructor_unqualified', 'instructor_capacity', 'calendar_closed', 'retry_limit', 'weekly_right', 'daily_right', 'prerequisite', 'content_exhausted', 'no_time')
                        idle_reason = next((r for r in priority if r in reasons), 'other') if idle else ''
                        p.reasons['unused_minutes'] += idle
                        p.reasons['idle_minutes_' + idle_reason] += idle
                        row = {'calendar': self.calendar, 'case': p.case.name, 'minutes': p.minutes, 'day': index,
                               'date': self.date.isoformat(), 'active': active, 'active_days': p.active_days,
                               'day_study_minutes': p.day_minutes, 'unused_minutes': idle, 'idle_reason': idle_reason, 'study_minutes': p.study_minutes,
                               'credited_xp': p.ledger.credited, 'potential_xp': p.potential, 'cap_lost': p.ledger.cap_lost,
                               'phase_lost': p.phase_lost, 'failed_attempts': p.failed,
                               'reasons': '|'.join(sorted(reasons))}
                        for f in FIELDS:
                            row[f + '_level'] = p.level[f]
                            row[f + '_xp'] = p.ledger.xp[f]
                        p.history.append(row)
            if index >= record_until and all(self.probe.level[f] >= 10 for f in self.probe.targets):
                break
        return self
