"""B+ finite evidence, admission, alternative-route and metric research tests."""
from copy import deepcopy
from dataclasses import replace
from datetime import date,timedelta
import json
from pathlib import Path
import unittest

from bplus_sim import BPlusSimulation,Source,Sources
from bplus_study import make,nonxp_metrics
from calendar_sim import Case,monday

HERE=Path(__file__).parent
BASE=json.loads((HERE/'config.json').read_text())
CFG=json.loads((HERE/'calendar-config.json').read_text())
PROPOSAL=json.loads((HERE/'bplus-config.json').read_text())


def sim(variant='Bplus_paced',minutes=30,case=None,library=None):
    return BPlusSimulation(BASE,CFG,PROPOSAL,variant,minutes,case or Case(cohort=1),library=library)


def ready(p,level=3):
    p.level['plumbing']=level;p.ledger.xp['plumbing']=p.limits[level]
    p.evidence['plumbing','starter']=3
    if level>=6:p.evidence['plumbing','middle']=3


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.registry=Sources()
        self.source=Source('approved-evidence','plumbing',None,'building_need',('valve-a','leak',32),date(2027,1,4),date(2027,1,7),'initial')
        self.registry.register(self.source)

    def test_display_and_date_cannot_reaward_source(self):
        self.assertTrue(self.registry.claim(self.source,'learner0',date(2027,1,4)))
        alias=replace(self.source,display='new-task',opens=date(2027,2,1),closes=date(2027,2,8))
        self.assertFalse(self.registry.claim(alias,'learner0',date(2027,2,1)))
        self.assertFalse(self.registry.claim(alias,'learner1',date(2027,2,1)))
        self.assertEqual(len(self.registry.claims),1)

    def test_alias_cannot_extend_expired_real_need(self):
        alias=replace(self.source,closes=date(2028,1,1))
        self.assertFalse(self.registry.eligible(alias,'learner0',date(2027,1,8)))

    def test_unregistered_and_retargeted_evidence_rejected(self):
        for alias in (replace(self.source,evidence_id='fresh-uuid'),replace(self.source,field='business'),replace(self.source,context=('other-fault',))):
            with self.assertRaises(ValueError):self.registry.claim(alias,'learner0',date(2027,1,4))
        with self.assertRaises(ValueError):self.registry.register(self.source)

    def test_underlying_source_cannot_be_registered_with_fresh_id(self):
        alias=replace(self.source,evidence_id='renamed-id',display='new title',opens=date(2027,2,1))
        with self.assertRaises(ValueError):self.registry.register(alias)

    def test_private_assignment_other_player_cannot_claim(self):
        source=replace(self.source,evidence_id='personal',owner='learner0')
        self.registry.register(source)
        self.assertFalse(self.registry.claim(source,'learner1',date(2027,1,4)))

    def test_case_catalogue_is_finite_and_not_regenerated(self):
        s=sim();initial=set(s.sources.records)
        s.run(400)
        self.assertEqual(set(s.sources.records),initial)
        self.assertLessEqual(len(s.sources.claims),len(initial))
        cases=[v for v in s.sources.records.values()if v.kind=='case'and v.field=='plumbing']
        self.assertEqual(len(cases),192)
        self.assertEqual(len({v.context for v in cases}),192)

    def test_pending_case_backlog_preserves_identity_not_real_need_expiry(self):
        s=sim();case=next(v for v in s.sources.records.values()if v.kind=='case')
        need=next(v for v in s.sources.records.values()if v.kind=='building_need')
        self.assertTrue(s.sources.eligible(case,'learner0',date(2027,6,1)))
        self.assertFalse(s.sources.eligible(need,'learner0',date(2027,6,1)))


class AdmissionTests(unittest.TestCase):
    def test_prebooking_waits_until_open_and_consumes_capacity_once(self):
        s=sim('queue_only');p=s.probe;ready(p);reasons=set()
        self.assertFalse(s.course_entry(p,'plumbing','middle','plumbing:middle:module1',reasons))
        s.date+=timedelta(days=1);p.day=s.date
        self.assertFalse(s.course_entry(p,'plumbing','middle','plumbing:middle:module1',set()))
        slot=s.reservations[p.key,'plumbing:middle:module1']
        for _ in range(5):s.course_entry(p,'plumbing','middle','plumbing:middle:module1',set())
        self.assertEqual(sum(s.teacher_starts.values()),1)
        s.date=slot.opens;p.day=s.date;p.daily.clear()
        self.assertTrue(s.course_entry(p,'plumbing','middle','plumbing:middle:module1',set()))
        self.assertEqual(p.daily['plumbing','course_start'],1)
        self.assertEqual(sum(s.teacher_starts.values()),1)

    def test_absent_reservation_is_recorded_not_free_capacity(self):
        s=sim('queue_only');p=s.probe;ready(p)
        s.course_entry(p,'plumbing','middle','plumbing:middle:module1',set())
        s.date+=timedelta(days=1);s._queue_tick()
        slot=s.reservations[p.key,'plumbing:middle:module1']
        s.date=slot.closes;s._queue_tick()
        self.assertEqual(s.extra['missed_reservations'],1)

    def test_mastered_learner_cannot_hold_future_queue_capacity(self):
        s=sim('queue_only');p=s.probe;ready(p)
        s.course_entry(p,'plumbing','middle','plumbing:middle:module1',set())
        s.date+=timedelta(days=1);s._queue_tick()
        p.level['plumbing']=10
        s.date+=timedelta(days=1);s._queue_tick()
        self.assertFalse(s.queue)
        self.assertFalse(s.reservations)

    def test_future_cancellation_releases_same_slot_budget(self):
        s=sim('queue_only');p=s.probe;ready(p)
        s.course_entry(p,'plumbing','middle','plumbing:middle:module1',set())
        s.date+=timedelta(days=1);s._queue_tick()
        slot=s.reservations[p.key,'plumbing:middle:module1']
        self.assertGreater(slot.opens,s.date)
        s._cancel(p,'plumbing:middle:module1')
        self.assertEqual(s.session_starts[slot.key],0)
        self.assertEqual(s.teacher_starts[monday(slot.opens),'plumbing','middle'],0)

    def test_capacities_never_increased_by_queue_or_alternative(self):
        s=sim(case=Case(cohort=12)).run(300)
        for (week,field,kind),count in s.teacher_starts.items():
            self.assertGreaterEqual(count,0)
            self.assertLessEqual(count,6 if kind=='middle'else 2)
        self.assertTrue(all(0<=v<=2 for v in s.session_starts.values()))
        self.assertEqual(len(s.cfg['pilot_instructors']),2)

    def test_selfstudy_same_module_no_duplicate_reward(self):
        s=sim('study_only');p=s.probe;ready(p)
        key='plumbing:middle:module1'
        self.assertTrue(s.selfstudy_entry(p,'plumbing','middle',key,{'instructor_capacity'}))
        s.spend(p,'plumbing',key,'middle',25,24,'middle',25)
        xp=p.ledger.credited
        self.assertFalse(s.course_entry(p,'plumbing','middle',key,set()))
        self.assertFalse(p.complete(s.cfg,'plumbing',key,'middle',15,24,'middle'))
        self.assertEqual(p.ledger.credited,xp)
        self.assertEqual(p.evidence['plumbing','middle'],1)

    def test_selfstudy_does_not_skip_prerequisite_or_partial_work(self):
        s=sim('study_only');p=s.probe
        self.assertFalse(s.selfstudy_entry(p,'plumbing','middle','plumbing:middle:module1',{'instructor_capacity'}))
        ready(p);key='plumbing:middle:module1'
        self.assertTrue(s.selfstudy_entry(p,'plumbing','middle',key,{'instructor_capacity'}))
        s.spend(p,'plumbing',key,'middle',25,24,'middle',15)
        self.assertNotIn(key,p.completed)
        self.assertEqual(p.evidence['plumbing','middle'],0)
        s.spend(p,'plumbing',key,'middle',25,24,'middle',10)
        self.assertIn(key,p.completed)

    def test_selfstudy_counts_existing_course_rights_and_finite_subset(self):
        s=sim('study_only');p=s.probe;ready(p)
        p.daily['plumbing','course_start']=1
        self.assertFalse(s.selfstudy_entry(p,'plumbing','middle','plumbing:middle:module1',{'instructor_capacity'}))
        p.daily.clear()
        self.assertFalse(s.selfstudy_entry(p,'plumbing','middle','plumbing:middle:module5',{'instructor_capacity'}))
        self.assertFalse(s.selfstudy_entry(p,'plumbing','middle','plumbing:middle:module1',{'weekly_right'}))

    def test_pilot_does_not_gain_expert_route(self):
        s=sim(case=Case(cohort=6,expert_available=False)).run(300)
        self.assertEqual(s.probe.level['plumbing'],6)
        self.assertEqual(s.probe.ledger.xp['plumbing'],700)

    def test_short_starter_and_expert_gates_retained(self):
        for field in BASE['skills']:
            s=sim(minutes=15,case=Case(targets=(field,),cohort=1)).run(14)
            self.assertEqual(s.probe.level_hits[field,3]['day'],4)
            self.assertEqual(s.probe.evidence[field,'starter'],3)
        self.assertEqual(CFG['gates']['10'],{'expert':4,'expert_practice':28,'project_minutes':10})


class MetricTests(unittest.TestCase):
    def test_full180_metric_does_not_hide_days_after_mastery(self):
        s=sim(minutes=30).run(400);p=s.probe
        full=sum(r['active']and r['day_study_minutes']==0 for r in p.history)
        self.assertGreater(full,p.reasons['no_work_active_days'])
        self.assertEqual(len(p.history),180)

    def test_nonxp_measurement_does_not_modify_learning_or_rewards(self):
        s=sim().run(180);before=deepcopy(s.probe.history);xp=s.probe.ledger.credited
        result=nonxp_metrics(s.probe.history,30,'sparse_existing')
        self.assertEqual(s.probe.history,before)
        self.assertEqual(s.probe.ledger.credited,xp)
        self.assertEqual(result['actual_no_meaningful_activity_days'],'UNKNOWN')
        self.assertLessEqual(result['no_modeled_learning_or_community_days'],result['no_learning_full180'])

    def test_paced_rights_cannot_consume_future_days(self):
        s=sim();p=s.probe;ready(p)
        p.daily['plumbing','practice']=1;p.weekly[monday(s.date),'plumbing','practice']=1
        reasons=set()
        self.assertEqual(s.practice(p,'plumbing','middle',10,reasons),0)
        self.assertIn('paced_right',reasons)
        self.assertTrue(s.denials)

    def test_missed_day_can_use_two_current_tasks_not_automatic_xp(self):
        s=sim();p=s.probe;ready(p)
        s.date+=timedelta(days=1);p.day=s.date
        before=p.ledger.credited
        self.assertEqual(s.practice(p,'plumbing','middle',10,set()),10)
        self.assertEqual(s.practice(p,'plumbing','middle',10,set()),10)
        self.assertEqual(p.ledger.credited-before,36)
        self.assertEqual(s.practice(p,'plumbing','middle',10,set()),0)

    def test_failed_source_not_claimed_and_later_retry_gives_one_credit(self):
        s=sim(case=Case(cohort=1,failure_every=1));p=s.probe;ready(p)
        self.assertEqual(s.practice(p,'plumbing','middle',10,set()),10)
        self.assertEqual(p.ledger.credited,0)
        self.assertFalse(s.sources.claims)
        p.case.failure_every=0;s.date+=timedelta(days=1);p.day=s.date;p.daily.clear()
        self.assertEqual(s.practice(p,'plumbing','middle',10,set()),10)
        self.assertEqual(len(s.sources.claims),1)
        self.assertEqual(p.ledger.credited,18)

    def test_login_without_work_has_no_credit(self):
        s=sim(minutes=0).run(14)
        self.assertEqual(s.probe.ledger.credited,0)
        self.assertFalse(any(v==s.probe.key for v in s.sources.claims.values()))

    def test_small_library_can_block_mastery_honestly(self):
        s=sim(library=64).run(600)
        self.assertNotIn(('plumbing',10),s.probe.level_hits)
        self.assertLessEqual(s.probe.ledger.xp['plumbing'],3540)

    def test_absence_has_no_decay_and_xp_limits_hold(self):
        s=sim(case=Case(attendance='break14')).run(180);p=s.probe
        self.assertEqual(p.history[6]['credited_xp'],p.history[20]['credited_xp'])
        self.assertTrue(all(n<=70 for (d,field),n in p.ledger.skill_day.items()))
        self.assertTrue(all(n<=110 for n in p.ledger.total_day.values()))

    def test_reproducible_and_configs_not_mutated(self):
        before=json.dumps([BASE,CFG,PROPOSAL],sort_keys=True)
        a=sim().run(180);b=sim().run(180)
        self.assertEqual(a.probe.history,b.probe.history)
        self.assertEqual(json.dumps([BASE,CFG,PROPOSAL],sort_keys=True),before)

    def test_old43_files_need_no_changes(self):
        # Legacy B measurement remains independently reproducible.
        old=make(BASE,CFG,PROPOSAL,'B_original',30,Case()).probe
        self.assertEqual(old.reasons['no_work_active_days'],44)
        self.assertEqual(old.level_hits['plumbing',10]['day'],226)


if __name__=='__main__':unittest.main()
