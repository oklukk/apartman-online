"""B+ finite-source and access study. Memory-only, never an application service.

The fixed case catalogue is a synthetic demand assumption, NOT192 authored games.
Identity is an immutable evidence/assignment ID, never a changed display name/date.
Expert access remains a separately hypothetical route; pilot-only stops at level6.
"""
from __future__ import annotations
from collections import Counter, defaultdict
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, timedelta
import hashlib

from calendar_sim import CalendarSimulation, Case, FIELDS, Offering, monday, offerings, qualified_instructor


@dataclass(frozen=True)
class Source:
    evidence_id: str
    field: str
    owner: str | None
    kind: str
    context: tuple
    opens: date
    closes: date
    display: str = ''


class Sources:
    """Finite pre-registered logical evidence; presentation is not authority."""
    def __init__(self):
        self.records: dict[str, Source] = {}
        self.claims: dict[str, str] = {}
        self.semantic: set = set()
        self.by_owner: dict[tuple, list[Source]] = defaultdict(list)

    def register(self, source: Source):
        semantic=source.field,source.owner,source.kind,source.context
        if source.evidence_id in self.records or semantic in self.semantic:
            raise ValueError('Duplicate evidence identity or underlying context')
        self.semantic.add(semantic)
        self.records[source.evidence_id] = source
        self.by_owner[source.owner, source.field].append(source)

    def canonical(self, proposed: Source) -> Source:
        actual = self.records.get(proposed.evidence_id)
        if actual is None or (actual.field, actual.owner, actual.kind, actual.context) != (proposed.field, proposed.owner, proposed.kind, proposed.context):
            raise ValueError('Unregistered or retargeted evidence')
        return actual

    def eligible(self, source: Source, learner: str, day: date) -> bool:
        actual = self.canonical(source)
        return actual.owner in (None, learner) and actual.evidence_id not in self.claims and actual.opens <= day < actual.closes

    def claim(self, source: Source, learner: str, day: date) -> bool:
        actual = self.canonical(source)
        if not self.eligible(source, learner, day):
            return False
        self.claims[actual.evidence_id] = learner
        return True


def release_offset(index: int, per_week: int, balanced: bool) -> int:
    week, slot = divmod(index, per_week)
    if balanced:
        # Same weekly supply; spread evenly rather than loading spare tasks on Monday.
        weekday = slot * 7 // per_week
    else:
        counts = [per_week // 7 + int(d < per_week % 7) for d in range(7)]
        weekday = 0
        while slot >= counts[weekday]:
            slot -= counts[weekday]; weekday += 1
    return week * 7 + weekday


class BPlusSimulation(CalendarSimulation):
    def __init__(self, base, cfg, proposal, variant, minutes, case=None, *, library=None):
        super().__init__(base, cfg, 'B', minutes, deepcopy(case))
        self.proposal = proposal
        self.variant = variant
        self.policy = proposal['variants'][variant]
        self.schedule = dict(self.schedule)
        self.schedule['practice_daily'] = self.policy['practice_daily']
        self.schedule['practice_weekly'] = self.policy['practice_weekly']
        for p in self.learners:
            p.case.starter_minutes = proposal['starter_minutes']
            p.case.starter_xp = proposal['starter_xp']
        self.sources = Sources()
        self.case_library = library if library is not None else proposal['case_library_per_field']
        self.queue: dict[tuple, tuple] = {}
        self.reservations: dict[tuple, Offering] = {}
        self.used_reservations: set = set()
        self.routes: dict[tuple, str] = {}
        self.extra = Counter()
        self.denials: set[tuple] = set()
        self.future_daily: Counter = Counter()
        self.last_queue_day = None
        self.waits: list[tuple] = []
        reference = date.fromisoformat(cfg['reference_date'])
        for p in self.learners:
            for field in dict.fromkeys((*FIELDS,*p.targets)):
                for i in range(self.case_library):
                    # Fixed asset/fault/evidence combinations, no date in pedagogical identity.
                    assets = ('mutfak armatürü','banyo hattı','giriş vanası','bahçe hattı','çatı deposu','çamaşır hattı','sayaç bağlantısı','ortak lavabo') if field=='plumbing' else ('sipariş çizelgesi','stok sayımı','fatura dosyası','tedarik listesi','bakım planı','teslim çizelgesi','gider özeti','malzeme formu')
                    faults = ('sızıntı','düşük debi','basınç değişimi','tıkanıklık') if field=='plumbing' else ('eksik belge','miktar farkı','fiyat farkı','teslim gecikmesi')
                    if field not in FIELDS:
                        assets=('örnek anlatım','ders planı','uygulama yönergesi','geri bildirim','ölçme sorusu','çalışma kağıdı','kavram haritası','ders özeti')
                        faults=('eksik adım','yanlış varsayım','belirsiz örnek','ölçme uyumsuzluğu')
                    measured = (12,18,25,32,45,55)[i//32]
                    decision = ('önce güvenli izolasyon' if measured>=45 else 'önce bağlantı kontrolü') if field=='plumbing' else ('belge doğrulama ve yeniden planlama' if measured>=45 else 'kalem bazında kontrol')
                    if field not in FIELDS:decision='kanıta göre anlatımı sadeleştir ve kontrol sorusu oluştur'
                    context = (assets[i%8],faults[i//8%4],measured,decision)
                    identity = f'case:{p.key}:{field}:' + hashlib.sha256(repr(context).encode()).hexdigest()[:16]
                    opens = reference + timedelta(days=release_offset(i, self.policy['pool_weekly'], self.policy['balanced']))
                    self.sources.register(Source(identity, field, p.key, 'case', context, opens,
                        (reference+timedelta(days=proposal['horizon']+1)) if self.policy.get('case_backlog') else opens + timedelta(days=self.schedule['practice_window_days'])))
        if self.policy['building_needs']:
            for field in FIELDS:
                for i in range(proposal['shared_need_total_per_field']):
                    opens = reference + timedelta(days=release_offset(i, proposal['shared_need_weekly'], True))
                    self.sources.register(Source(f'incident:{field}:{i}',field,None,'building_need',
                        ('fixture-incident',i,'independent-outcome-evidence'),opens,opens+timedelta(days=3)))

    def _cancel(self, p, content):
        key = p.key, content
        slot = self.reservations.pop(key, None)
        if slot is not None and key not in self.used_reservations and self.date < slot.opens:
            field, kind = content.split(':')[:2]
            self.session_starts[slot.key] -= 1
            self.teacher_starts[monday(slot.opens),field,kind] -= 1
            p.weekly[monday(slot.opens),field,'course_start'] -= 1
            self.future_daily[slot.opens,p.key,field] -= 1
            self.extra['future_reservations_cancelled'] += 1
        p.enrolled.pop(content,None)
        self.used_reservations.discard(key)

    def _queue_tick(self):
        if self.last_queue_day == self.date:
            return
        self.last_queue_day = self.date
        for p in self.learners:
            for key, slot in list(self.reservations.items()):
                if key[0] != p.key: continue
                if key[1] in p.completed or p.level[key[1].split(':')[0]]>=10 or p.stage(key[1].split(':')[0]) != key[1].split(':')[1]:
                    self._cancel(p,key[1])
                elif self.date >= slot.closes:
                    if key not in self.used_reservations:
                        self.extra['missed_reservations'] += 1
                    self._cancel(p,key[1])
        for request, (requested,content) in sorted(self.queue.items(),key=lambda item:(item[1][0],item[0])):
            learner,field,kind = request
            p = next(p for p in self.learners if p.key==learner)
            if content in p.completed or p.level[field]>=10 or p.stage(field)!=kind:
                del self.queue[request];continue
            if (p.key,content) in self.reservations:
                continue
            # Pre-register at most7days ahead; absent learners may hold and miss a seat.
            for ahead in range(self.proposal['prebook_days']+1):
                day=self.date+timedelta(days=ahead)
                slots=offerings(self.cfg,self.schedule,field,kind,day)
                slots=[s for s in slots if s.opens>=self.date]
                weekly_limit=self.schedule['instructor_weekly_starts' if kind=='middle' else 'expert_weekly_starts']*self.case.capacity_multiplier
                seat_limit=self.schedule['seats_per_session' if kind=='middle' else 'expert_seats']*self.case.capacity_multiplier
                chosen=None
                for slot in slots:
                    week=monday(slot.opens)
                    if (self.session_starts[slot.key]<seat_limit and self.teacher_starts[week,field,kind]<weekly_limit
                        and p.weekly[week,field,'course_start']<self.schedule['course_weekly']
                        and self.future_daily[slot.opens,p.key,field]<self.schedule['course_daily']):
                        chosen=slot;break
                if chosen is None:continue
                week=monday(chosen.opens)
                self.session_starts[chosen.key]+=1;self.teacher_starts[week,field,kind]+=1
                p.weekly[week,field,'course_start']+=1
                self.future_daily[chosen.opens,p.key,field]+=1
                p.enrolled[content]=chosen;self.reservations[p.key,content]=chosen
                self.extra['prebooked']+=1
                break

    def course_entry(self,p,field,kind,content,reasons):
        if self.routes.get((p.key,content))=='self':
            reasons.add('selfstudy_in_progress');return False
        if not self.policy['queue']:
            return super().course_entry(p,field,kind,content,reasons)
        self._queue_tick()
        if content in p.completed:
            return False
        level,credential=(3,'starter')if kind=='middle'else(6,'middle')
        if p.level[field]<level or p.evidence[field,credential]<3:
            reasons.add('prerequisite');return False
        if kind=='middle' and not qualified_instructor(self.cfg['pilot_instructors'].get(field,{})):
            reasons.add('instructor_unqualified');return False
        if kind=='expert' and not p.case.expert_available:
            reasons.add('expert_unavailable');return False
        slot=self.reservations.get((p.key,content))
        if slot and slot.contains(self.date):
            key=p.key,content
            if key not in self.used_reservations:
                if p.daily[field,'course_start']>=self.schedule['course_daily']:
                    reasons.add('daily_right');return False
                p.daily[field,'course_start']+=1
                self.used_reservations.add(key)
                self.extra['attended_reservations']+=1
                request=self.queue.get((p.key,field,kind))
                if request and request[1]==content:self.waits.append((p.key,field,kind,(self.date-request[0]).days))
            return True
        request=p.key,field,kind
        if request not in self.queue or self.queue[request][1]!=content:
            self.queue[request]=self.date,content
        reasons.add('prebook_wait')
        return False

    def selfstudy_entry(self,p,field,stage,content,reasons):
        key=p.key,content
        if self.routes.get(key)=='self': return True
        if not self.policy['selfstudy'] or not reasons.intersection({'instructor_capacity','calendar_closed','prebook_wait'}):
            return False
        if stage=='expert' and not p.case.expert_available:return False
        required,credential=(3,'starter')if stage=='middle'else(6,'middle')
        if p.level[field]<required or p.evidence[field,credential]<3:
            reasons.add('prerequisite');return False
        number=int(content.rsplit('module',1)[1])
        if number>self.proposal['selfstudy_max_per_stage']:return False
        week=monday(self.date)
        if (p.daily[field,'course_start']>=self.schedule['course_daily'] or
            p.weekly[week,field,'course_start']>=self.schedule['course_weekly'] or
            p.weekly[week,field,'selfstudy']>=self.proposal['selfstudy_weekly']):
            reasons.add('selfstudy_right');return False
        # Exact same module and evidence identity, alternative delivery + assessment, not extra reward.
        self._cancel(p,content)
        self.queue.pop((p.key,field,stage),None)
        p.daily[field,'course_start']+=1;p.weekly[week,field,'course_start']+=1
        p.weekly[week,field,'selfstudy']+=1
        self.routes[key]='self';self.extra['selfstudy_starts']+=1
        return True

    def practice(self,p,field,stage,remaining,reasons):
        if self.blocked_retry(p,field,reasons):return 0
        if remaining<self.cfg['content']['practice_minutes']:
            reasons.add('no_time');return 0
        candidates=list(self.sources.by_owner[p.key,field])
        if p.level[field]>=3:
            candidates+=self.sources.by_owner[None,field]
        candidates=[s for s in candidates if self.sources.eligible(s,p.key,self.date)]
        candidates.sort(key=lambda s:(s.closes,s.kind,s.evidence_id))
        if not candidates:
            reasons.add('source_unavailable');return 0
        week=monday(self.date)
        reason=None
        if p.daily[field,'practice']>=self.schedule['practice_daily']:reason='daily_right'
        elif p.weekly[week,field,'practice']>=self.schedule['practice_weekly']:reason='weekly_right'
        elif self.policy.get('paced') and p.weekly[week,field,'practice']>=self.date.weekday()+1:reason='paced_right'
        if reason:
            reasons.add(reason)
            self.denials.add((p.key,self.date,field,reason,candidates[0].evidence_id))
            return 0
        source=candidates[0]
        p.daily[field,'practice']+=1;p.weekly[week,field,'practice']+=1
        used=self.spend(p,field,source.evidence_id,'practice',10,p.rewards['practice'],stage,remaining)
        if source.evidence_id in p.completed:
            assert self.sources.claim(source,p.key,self.date)
            self.extra['completed_'+source.kind]+=1
        return used

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
            elif not self.blocked_retry(p, field, reasons):
                key=p.key,module_id
                if self.routes.get(key)=='self':
                    access=True
                else:
                    access=self.course_entry(p,field,stage,module_id,reasons)
                    if not access and key not in self.routes:
                        access=self.selfstudy_entry(p,field,stage,module_id,reasons)
                    if access and key not in self.routes:self.routes[key]='class'
                if access:
                    duration=self.proposal['selfstudy_minutes'] if self.routes.get(key)=='self' else content_cfg['module_minutes']
                    used=self.spend(p,field,module_id,stage,duration,p.rewards['course'],stage,remaining)
                    if used:return used
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
        return self.practice(p,field,stage,remaining,reasons)
