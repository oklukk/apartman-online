"""Independent offline arithmetic/behavior checks; no DB/game imports or writes."""
import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import unittest

from simulate import Ledger, Scenario, Simulation, apportion, best_plan, normalized_steps, steps, thresholds

CONFIG = json.loads((Path(__file__).parent / 'config.json').read_text())
STAMP = datetime(2027, 1, 4, 9, tzinfo=timezone.utc)


class ArithmeticTests(unittest.TestCase):
    def test_known_thresholds(self):
        self.assertEqual(thresholds(CONFIG['models']['A']), list(range(0, 801, 80)))
        self.assertEqual(thresholds(CONFIG['models']['B']), [0, 20, 60, 140, 260, 440, 700, 1080, 1640, 2440, 3540])
        self.assertEqual(thresholds(CONFIG['models']['C'])[-1], 11550)
        self.assertEqual(thresholds(CONFIG['models']['C'])[7], 4200)

    def test_equal_total_isolates_shape(self):
        for model in CONFIG['models'].values():
            values = normalized_steps(model, 3600)
            self.assertEqual(sum(values), 3600)
            self.assertTrue(all(v > 0 for v in values))
        self.assertEqual(apportion(30, {'plumbing': 80, 'business': 20}), {'plumbing': 24, 'business': 6})

    def test_plan_respects_time_and_repeat_limits(self):
        plan = best_plan(30, (('course', 15, 24, 1), ('practice', 10, 18, 2)))
        self.assertEqual(plan, ('course', 'practice'))
        self.assertEqual(best_plan(15, (('course', 15, 24, 3), ('practice', 10, 18, 3))), ('course',))


class LedgerTests(unittest.TestCase):
    def test_replay_cannot_move_day_or_skill(self):
        ledger = Ledger(1000, 70, 50)
        ledger.award('order', {'plumbing': 60}, STAMP)
        replay = ledger.award('order', {'plumbing': 60}, STAMP.replace(day=5))
        self.assertFalse(replay.new)
        self.assertEqual(ledger.xp['plumbing'], 50)
        with self.assertRaises(ValueError):
            ledger.award('order', {'business': 60}, STAMP)
        with self.assertRaises(ValueError):
            ledger.award('order', {'plumbing': 61}, STAMP)

    def test_award_day_is_turkey_day_not_reservation(self):
        ledger = Ledger(1000, 50, 50)
        before = datetime(2027, 1, 4, 20, 59, tzinfo=timezone.utc)
        after = datetime(2027, 1, 4, 21, 0, tzinfo=timezone.utc)
        ledger.award('a', {'plumbing': 50}, before)
        ledger.award('b', {'plumbing': 50}, after, reserved_at=before)
        self.assertEqual(ledger.xp['plumbing'], 100)
        self.assertEqual(sorted(ledger.total_day.values()), [50, 50])
        with self.assertRaises(ValueError):
            ledger.award('c', {'plumbing': 1}, datetime(2027, 1, 5))

    def test_shared_caps_across_activity_names(self):
        ledger = Ledger(1000, 110, 70)
        for i in range(12):
            ledger.award(f'activity-business-career-{i}', {'plumbing': 20, 'business': 20}, STAMP)
        self.assertEqual(ledger.credited, 110)
        self.assertLessEqual(ledger.xp['plumbing'], 70)
        self.assertLessEqual(ledger.xp['business'], 70)
        self.assertEqual(ledger.raw, ledger.credited + ledger.cap_lost + ledger.max_lost)

    def test_skill_only_cap_permits_wider_progress(self):
        ledger = Ledger(1000, None, 70)
        ledger.award('a', {s: 100 for s in CONFIG['skills']}, STAMP)
        self.assertEqual(ledger.credited, 280)

    def test_failed_attempt_no_award_then_verified_once(self):
        ledger = Ledger(100, 50, 50)
        ledger.award('a', {'plumbing': 20}, STAMP, verified=False)
        self.assertEqual(ledger.credited, 0)
        ledger.award('a', {'plumbing': 20}, STAMP)
        ledger.award('a', {'plumbing': 20}, STAMP)
        self.assertEqual(ledger.credited, 20)

    def test_maximum_and_consumed_capped_remainder(self):
        ledger = Ledger(80, 50, None)
        ledger.award('a', {'plumbing': 100}, STAMP)
        ledger.award('a', {'plumbing': 100}, STAMP.replace(day=5))
        self.assertEqual(ledger.credited, 50)
        ledger.award('b', {'plumbing': 100}, STAMP.replace(day=5))
        self.assertEqual(ledger.credited, 80)
        self.assertEqual(ledger.raw, 200)
        self.assertEqual(ledger.raw, ledger.credited + ledger.cap_lost + ledger.max_lost)


class ScenarioTests(unittest.TestCase):
    def test_initial_state_zero_and_repeatable(self):
        a = Simulation(CONFIG, 'B', 30, Scenario('deterministic')).run(30)
        b = Simulation(CONFIG, 'B', 30, Scenario('deterministic')).run(30)
        self.assertEqual(a.history, b.history)
        self.assertEqual(Simulation(CONFIG, 'B', 30, Scenario('fresh')).ledger.credited, 0)

    def test_absence_creates_neither_xp_nor_catchup_budget(self):
        sim = Simulation(CONFIG, 'B', 30, Scenario('pause', attendance='break')).run(30)
        self.assertEqual(sim.history[13]['credited_xp'], sim.history[27]['credited_xp'])
        gain = sim.history[28]['credited_xp'] - sim.history[27]['credited_xp']
        self.assertLessEqual(gain, 70)
        self.assertLessEqual(sim.minutes_used, sim.active_days * 30)

    def test_long_absence_no_retroactive_xp(self):
        sim = Simulation(CONFIG, 'B', 30, Scenario('long_pause', attendance='long_break')).run(91)
        self.assertEqual(sim.history[29]['credited_xp'], sim.history[89]['credited_xp'])
        self.assertLessEqual(sim.history[90]['credited_xp'] - sim.history[89]['credited_xp'], 70)
        self.assertEqual(sim.active_days, 31)

    def test_missing_business_access_blocks_paid_jobs(self):
        sim = Simulation(CONFIG, 'B', 60, Scenario('no_course', ('plumbing', 'business'), paid=True,
                         inaccessible=('business',))).run(180)
        self.assertEqual(sim.level['business'], 0)
        self.assertEqual(sim.paid_completions, 0)
        self.assertIsNone(sim.ready_day)

    def test_missing_qualification_does_not_fabricate_expertise(self):
        sim = Simulation(CONFIG, 'B', 120, Scenario('no_provider', no_qualifications=True)).run(180)
        self.assertEqual(sim.level['plumbing'], 6)
        self.assertEqual(sim.ledger.xp['plumbing'], 3540)
        self.assertTrue(sim.history[-1]['plumbing_gate_blocked'])

    def test_small_sessions_can_complete_large_qualification(self):
        sim = Simulation(CONFIG, 'C', 15, Scenario('accessible')).run(700)
        self.assertEqual(sim.level['plumbing'], 10)
        self.assertEqual(sim.qual_minutes['plumbing', 10], 60)
        self.assertLessEqual(sim.minutes_used, sim.active_days * 15)

    def test_unqualified_paid_source_is_not_scheduled(self):
        sim = Simulation(CONFIG, 'B', 30, Scenario('paid', ('plumbing', 'business'), paid=True)).run(10)
        self.assertIsNone(sim.ready_day)
        self.assertEqual(sim.paid_completions, 0)

    def test_conserved_split_vs_additive_is_explicit(self):
        sims = []
        for policy in ('main_only', 'conserved_split', 'additive_split'):
            config = copy.deepcopy(CONFIG)
            sim = Simulation(config, 'B', 30, Scenario('split', paid=True, multi=policy, gates='xp_only'))
            sim.day = 1
            sim.event('plumbing', 'paid', 15, 30)  # synthetic verified event, not production completion
            sims.append(sim)
        self.assertEqual([s.ledger.raw for s in sims], [30, 30, 36])
        self.assertEqual(sims[1].ledger.xp['business'], 6)

    def test_all_packages_bounded_and_time_feasible(self):
        for model in CONFIG['models']:
            sim = Simulation(CONFIG, model, 60, Scenario('bounded', ('plumbing', 'business'))).run(180)
            self.assertLessEqual(sim.minutes_used, 60 * sim.active_days)
            self.assertTrue(all(0 <= n <= 10 for n in sim.level.values()))
            self.assertEqual(sim.ledger.raw, sim.ledger.credited + sim.ledger.cap_lost + sim.ledger.max_lost)


if __name__ == '__main__':
    unittest.main()
