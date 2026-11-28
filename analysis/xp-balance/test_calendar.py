"""Finite-calendar analysis tests; no real users, database or production imports."""
import copy
from datetime import date, datetime, timezone
import json
from pathlib import Path
import unittest
from calendar_sim import CalendarSimulation, Case, Offering, monday, offerings, qualified_instructor, turkey_day

HERE=Path(__file__).parent
BASE=json.loads((HERE/'config.json').read_text())
CFG=json.loads((HERE/'calendar-config.json').read_text())


def fixture(minutes=30, case=None, calendar='B', cfg=None):
    return CalendarSimulation(BASE, copy.deepcopy(cfg or CFG), calendar, minutes, case or Case(cohort=1))


def middle_ready(p):
    p.level['plumbing']=3
    p.ledger.xp['plumbing']=140
    p.evidence['plumbing','starter']=3


class CalendarTests(unittest.TestCase):
    def test_turkey_boundaries_and_monday(self):
        self.assertEqual(turkey_day(datetime(2027,1,3,21,tzinfo=timezone.utc)),date(2027,1,4))
        self.assertEqual(monday(date(2027,1,10)),date(2027,1,4))
        with self.assertRaises(ValueError): turkey_day(datetime(2027,1,4))

    def test_window_open_close_exclusive(self):
        slot=Offering('test',date(2027,1,4),date(2027,1,7))
        self.assertTrue(slot.contains(date(2027,1,6)))
        self.assertFalse(slot.contains(date(2027,1,7)))
        slots=offerings(CFG,CFG['calendars']['C'],'plumbing','middle',date(2027,1,17))
        self.assertEqual(slots,[])

    def test_zero_level_path_no_instructor_seat(self):
        cfg=copy.deepcopy(CFG)
        cfg['pilot_instructors']={}
        sim=fixture(15,cfg=cfg).run(14)
        self.assertGreaterEqual(sim.probe.level['plumbing'],3)
        self.assertEqual(sum(sim.teacher_starts.values()),0)

    def test_all_four_skills_have_zero_level_starter_path(self):
        for skill in BASE['skills']:
            s=fixture(15,Case(targets=(skill,),cohort=1)).run(14)
            self.assertGreaterEqual(s.probe.level[skill],3)
        # No pilot instructor exists for teaching: do not pretend level4+ teaching courses exist.
        s=fixture(30,Case(targets=('advanced_teaching',),cohort=1)).run(90)
        self.assertEqual(s.probe.level['advanced_teaching'],3)

    def test_starter_alternatives_are_finite_and_separate(self):
        s=fixture(15,Case(cohort=1,starter_minutes=5,starter_xp=32)).run(14)
        self.assertEqual(s.probe.level_hits['plumbing',3]['day'],4)
        self.assertEqual(s.probe.evidence['plumbing','starter'],3)

    def test_course_prerequisites_independent_of_capacity(self):
        s=fixture();p=s.probe;r=set()
        self.assertFalse(s.course_entry(p,'plumbing','middle','plumbing:middle:module1',r))
        self.assertIn('prerequisite',r)
        self.assertEqual(sum(s.teacher_starts.values()),0)
        middle_ready(p)
        self.assertTrue(s.course_entry(p,'plumbing','middle','plumbing:middle:module1',set()))

    def test_qualification_not_a_capacity_formula(self):
        spec=CFG['pilot_instructors']['plumbing']
        self.assertTrue(qualified_instructor(spec))
        self.assertFalse(qualified_instructor(spec,7))
        bad={**spec,'advanced_teaching':2}
        self.assertFalse(qualified_instructor(bad))
        s=fixture();middle_ready(s.probe);s.cfg['pilot_instructors']['plumbing']=bad;r=set()
        self.assertFalse(s.course_entry(s.probe,'plumbing','middle','new',r))
        self.assertIn('instructor_unqualified',r)

    def test_two_seats_shared_by_students(self):
        s=fixture(case=Case(cohort=3))
        for p in s.learners:middle_ready(p)
        self.assertTrue(s.course_entry(s.learners[0],'plumbing','middle','a',set()))
        self.assertTrue(s.course_entry(s.learners[1],'plumbing','middle','b',set()))
        r=set();self.assertFalse(s.course_entry(s.learners[2],'plumbing','middle','c',r))
        self.assertIn('instructor_capacity',r)

    def test_existing_enrollment_not_counted_twice(self):
        s=fixture();p=s.probe;middle_ready(p)
        for _ in range(5):self.assertTrue(s.course_entry(p,'plumbing','middle','a',set()))
        self.assertEqual(sum(s.teacher_starts.values()),1)

    def test_expired_seat_reentry_keeps_content_identity(self):
        s=fixture();p=s.probe;middle_ready(p)
        s.course_entry(p,'plumbing','middle','a',set())
        old=p.enrolled['a']
        s.date=date(2027,1,11);p.day=s.date;p.daily.clear()
        self.assertFalse(old.contains(s.date))
        self.assertTrue(s.course_entry(p,'plumbing','middle','a',set()))
        self.assertNotEqual(old.key,p.enrolled['a'].key)
        p.complete(s.cfg,'plumbing','a','middle',15,24,'middle')
        xp=p.ledger.credited
        self.assertFalse(p.complete(s.cfg,'plumbing','a','middle',15,24,'middle'))
        self.assertEqual(p.ledger.credited,xp)
        self.assertFalse(s.course_entry(p,'plumbing','middle','a',set()))

    def test_daily_and_weekly_course_rights(self):
        s=fixture();p=s.probe;middle_ready(p)
        self.assertTrue(s.course_entry(p,'plumbing','middle','a',set()))
        r=set();self.assertFalse(s.course_entry(p,'plumbing','middle','b',r));self.assertIn('daily_right',r)
        p.daily.clear();p.weekly[monday(s.date),'plumbing','course_start']=3
        r=set();self.assertFalse(s.course_entry(p,'plumbing','middle','b',r));self.assertIn('weekly_right',r)
        s.date+=__import__('datetime').timedelta(days=7);p.day=s.date
        self.assertTrue(s.course_entry(p,'plumbing','middle','b',set()))

    def test_finite_books_and_modules_no_repeat_reward(self):
        s=fixture();p=s.probe
        p.complete(s.cfg,'plumbing','book1','book',10,8,'starter',can_fail=False)
        for _ in range(20):p.complete(s.cfg,'plumbing','book1','book',10,8,'starter',can_fail=False)
        self.assertEqual(p.ledger.credited,8)
        self.assertEqual(p.evidence['plumbing','book'],1)

    def test_xp_cannot_skip_mandatory_credentials(self):
        s=fixture();p=s.probe;p.ledger.xp['plumbing']=140;p.update(s.cfg)
        self.assertEqual(p.level['plumbing'],2)
        p.evidence['plumbing','starter']=3;p.update(s.cfg)
        self.assertEqual(p.level['plumbing'],3)

    def test_stage_ceiling_separate_from_daily_xp_cap(self):
        s=fixture();p=s.probe;p.ledger.xp['plumbing']=135
        p.complete(s.cfg,'plumbing','test','practice',10,18,'starter')
        self.assertEqual(p.ledger.xp['plumbing'],140)
        self.assertEqual(p.phase_lost,13)
        self.assertEqual(p.ledger.cap_lost,0)

    def test_daily_and_weekly_practice_limits_hold(self):
        s=fixture(120).run(180);p=s.probe
        practice=[e for e in p.events if e['kind']=='practice']
        from collections import Counter
        per_day=Counter(e['date']for e in practice)
        per_week=Counter(monday(date.fromisoformat(e['date']))for e in practice)
        self.assertTrue(all(n<=1 for n in per_day.values()))
        self.assertTrue(all(n<=5 for n in per_week.values()))
        self.assertLessEqual(sum(s.teacher_starts.values()),6*27+2*27)

    def test_failed_attempt_costs_time_and_no_xp(self):
        s=fixture(case=Case(failure_every=1,cohort=1));p=s.probe
        used=s.spend(p,'plumbing','module','starter',15,24,'starter',15)
        self.assertEqual(used,15);self.assertEqual(p.study_minutes,15)
        self.assertEqual(p.ledger.credited,0);self.assertNotIn('module',p.completed)
        self.assertEqual(p.work['module'],0)
        p.case.failure_every=0
        s.spend(p,'plumbing','module','starter',15,24,'starter',15)
        self.assertIn('module',p.completed);self.assertEqual(p.ledger.credited,24)

    def test_failure_budget_resets_on_week_boundary(self):
        s=fixture();p=s.probe;p.retry_counts[monday(s.date),'plumbing']=2
        self.assertTrue(s.blocked_retry(p,'plumbing',set()))
        s.date=date(2027,1,11)
        self.assertFalse(s.blocked_retry(p,'plumbing',set()))

    def test_partial_project_not_evidence_until_success(self):
        s=fixture(15);p=s.probe;p.level['plumbing']=8;p.ledger.xp['plumbing']=2440
        p.evidence['plumbing','expert']=3;p.evidence['plumbing','expert_practice']=18
        s.spend(p,'plumbing','project','project',20,0,'expert',15,evidence_kind='project9')
        self.assertEqual(p.level['plumbing'],8)
        s.spend(p,'plumbing','project','project',20,0,'expert',5,evidence_kind='project9')
        self.assertEqual(p.level['plumbing'],9)
        self.assertEqual(p.evidence['plumbing','project9'],20)

    def test_pilot_only_cannot_access_expert_content(self):
        s=fixture(120,Case(expert_available=False,cohort=1)).run(300)
        self.assertEqual(s.probe.level['plumbing'],6)
        self.assertEqual(s.probe.ledger.xp['plumbing'],700)
        self.assertTrue(all(kind!='expert'for _,_,kind in s.teacher_starts))

    def test_calendar_never_ends_when_background_finishes_first(self):
        s=fixture(15,Case(cohort=6)).run(400)
        self.assertEqual(s.probe.level['plumbing'],10)
        self.assertIn(('plumbing',10),s.probe.level_hits)
        self.assertGreater(s.probe.level_hits['plumbing',10]['day'],180)

    def test_irregular_and_absence_no_decay_or_bank(self):
        s=fixture(30,Case(attendance='break14',cohort=1)).run(22);p=s.probe
        self.assertEqual(p.history[6]['credited_xp'],p.history[20]['credited_xp'])
        self.assertEqual(p.history[6]['plumbing_level'],p.history[20]['plumbing_level'])
        self.assertLessEqual(p.history[21]['credited_xp']-p.history[20]['credited_xp'],70)

    def test_no_click_or_login_xp_without_study(self):
        s=fixture(0).run(30)
        self.assertEqual(s.probe.ledger.credited,0)
        self.assertEqual(s.probe.completed,set())

    def test_wait_metrics_are_days_not_minutes_and_reproduce(self):
        a=fixture(120).run(180);b=fixture(120).run(180)
        self.assertEqual(a.probe.history,b.probe.history)
        self.assertLessEqual(a.probe.reasons['instructor_capacity'],180)
        self.assertLessEqual(a.probe.reasons['no_work_active_days'],180)
        self.assertTrue(all(r['day_study_minutes']<=120 for r in a.probe.history))
        self.assertEqual(a.probe.reasons['unused_minutes'],sum(r['unused_minutes'] for r in a.probe.history))

    def test_no_makeup_can_exclude_specific_weekdays(self):
        # Friday expert admissions unavailable to Mon/Wed/Sat; broad7day window fixes access.
        s=CFG['calendars']['B']
        self.assertEqual(offerings(CFG,s,'plumbing','expert',date(2027,1,9),short_window=True),[])
        self.assertTrue(offerings(CFG,s,'plumbing','expert',date(2027,1,9)))

    def test_population_and_xp_parameters_unchanged(self):
        self.assertEqual(len(CFG['pilot_instructors']),2)
        self.assertEqual(BASE['models']['B']['curve_parameters']['steps'],[20,40,80,120,180,260,380,560,800,1100])
        self.assertEqual(BASE['models']['B']['caps'],{'general':110,'skill':70})


if __name__=='__main__':unittest.main()
