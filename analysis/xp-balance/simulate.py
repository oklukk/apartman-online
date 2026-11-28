"""Offline proposals only. No application imports, network, DB, actors or real XP writes.

All XP/time/access values come from this study's separate config, never production.
Core simulation uses only the Python standard library. Dates are synthetic server time.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from typing import Any
from zoneinfo import ZoneInfo

TURKEY = ZoneInfo("Europe/Istanbul")
SKILLS = ("plumbing", "business", "basic_teaching", "advanced_teaching")
MILESTONES = (1, 3, 5, 7, 10)


def steps(model: dict) -> list[int]:
    p = model["curve_parameters"]
    if model["curve"] == "linear":
        values = [p["step"]] * 10
    elif model["curve"] == "increasing":
        values = [p["factor"] * level ** p["power"] for level in range(1, 11)]
    elif model["curve"] == "hybrid":
        values = list(p["steps"])
    else:
        raise ValueError("Unknown proposal curve")
    if len(values) != 10 or any(type(x) is not int or x <= 0 for x in values):
        raise ValueError("Ten positive integer step costs required")
    return values


def thresholds(model: dict) -> list[int]:
    values = [0]
    for cost in steps(model):
        values.append(values[-1] + cost)
    return values


def apportion(total: int, weights: dict[str, int]) -> dict[str, int]:
    """Integer largest remainder; deterministic alphabetical tie break, no XP creation."""
    if total < 0 or any(w < 0 for w in weights.values()):
        raise ValueError("Nonnegative weights/total required")
    denom = sum(weights.values())
    if not denom:
        return {k: 0 for k in weights}
    out = {k: total * w // denom for k, w in weights.items()}
    order = sorted(weights, key=lambda k: (-(total * weights[k] % denom), k))
    for key in order[:total - sum(out.values())]:
        out[key] += 1
    return out


def normalized_steps(model: dict, total: int) -> list[int]:
    result = apportion(total, {str(i): n for i, n in enumerate(steps(model))})
    return [result[str(i)] for i in range(10)]


@lru_cache(maxsize=None)
def best_plan(minutes: int, items: tuple[tuple[str, int, int, int], ...]) -> tuple[str, ...]:
    """Bounded knapsack maximizing hypothetical raw XP for a target's remaining time.

    Daily caps are intentionally ignored here to measure counterfactual cap loss.
    Activity availability and repeat limits are already resolved by the caller.
    Ties prefer shorter time, then lexicographic schedule; not a player-behavior claim.
    """
    states: dict[int, tuple[int, tuple[str, ...]]] = {0: (0, ())}
    for kind, cost, reward, limit in items:
        previous = states
        states = dict(previous)
        for used, (value, actions) in previous.items():
            for number in range(1, limit + 1):
                nxt = used + cost * number
                if nxt > minutes:
                    break
                candidate = (value + reward * number, actions + (kind,) * number)
                old = states.get(nxt)
                if old is None or candidate[0] > old[0] or (candidate[0] == old[0] and candidate[1] < old[1]):
                    states[nxt] = candidate
    used, value = min(states.items(), key=lambda x: (-x[1][0], x[0], x[1][1]))
    return value[1]


@dataclass
class Receipt:
    credited: dict[str, int]
    cap_lost: int = 0
    max_lost: int = 0
    new: bool = True


class Ledger:
    """Hypothetical in-memory awards, NOT a database/production award implementation.

    A logical parent source can carry an allocation vector only in the multi-XP
    research scenario. Current SQL cannot do that; its one-target contract remains.
    Reservation time never determines the counter's day. Verified server award time does.
    """
    def __init__(self, maximum: int, general: int | None, skill_cap: int | None):
        self.maximum, self.general, self.skill_cap = maximum, general, skill_cap
        self.xp = {s: 0 for s in SKILLS}
        self.total_day: dict[date, int] = defaultdict(int)
        self.skill_day: dict[tuple[date, str], int] = defaultdict(int)
        self.seen: dict[str, tuple] = {}
        self.raw = self.credited = self.cap_lost = self.max_lost = self.failed = 0

    def award(self, source: str, allocations: dict[str, int], server_now: datetime,
              *, verified: bool = True, reserved_at: datetime | None = None) -> Receipt:
        if server_now.tzinfo is None:
            raise ValueError("Timezone-aware synthetic server time required")
        if not allocations or any(s not in SKILLS or type(x) is not int or x < 0 for s, x in allocations.items()):
            raise ValueError("Known skills and nonnegative integer proposal amounts required")
        payload = tuple(sorted(allocations.items()))
        if source in self.seen:
            if self.seen[source] != payload:
                raise ValueError("A source cannot be retargeted or its allocation changed")
            return Receipt({s: 0 for s in allocations}, new=False)
        if not verified:
            self.failed += sum(allocations.values())
            return Receipt({s: 0 for s in allocations}, new=False)
        self.seen[source] = payload  # Whole hypothetical parent consumed once, including a capped result.
        day = server_now.astimezone(TURKEY).date()
        eligible = {s: min(x, max(0, self.skill_cap - self.skill_day[day, s])) if self.skill_cap is not None else x
                    for s, x in allocations.items()}
        accepted = sum(eligible.values())
        if self.general is not None and accepted > max(0, self.general - self.total_day[day]):
            eligible = apportion(max(0, self.general - self.total_day[day]), eligible)
        capped = sum(allocations.values()) - sum(eligible.values())
        credited = {s: min(x, self.maximum - self.xp[s]) for s, x in eligible.items()}
        max_lost = sum(eligible.values()) - sum(credited.values())
        for s, value in credited.items():
            self.xp[s] += value
            self.skill_day[day, s] += value
        self.total_day[day] += sum(credited.values())
        self.raw += sum(allocations.values())
        self.credited += sum(credited.values())
        self.cap_lost += capped
        self.max_lost += max_lost
        assert self.raw == self.credited + self.cap_lost + self.max_lost
        return Receipt(credited, capped, max_lost)


@dataclass
class Scenario:
    name: str
    targets: tuple[str, ...] = ("plumbing",)
    goals: dict[str, int] = field(default_factory=dict)
    allocation: str = "adaptive"  # Under30m alternate whole days; >=30m split in5m units.
    attendance: str = "daily"
    start_day: int = 1
    paid: bool = False
    multi: str | None = None
    gates: str | None = None
    caps: dict | None = None
    inaccessible: tuple[str, ...] = ()
    no_qualifications: bool = False
    failure_every: int = 0
    rested_bonus: bool = False
    free_intro: bool = True


class Simulation:
    def __init__(self, config: dict, model_id: str, minutes: int, scenario: Scenario):
        self.config, self.model_id, self.minutes, self.scenario = config, model_id, minutes, scenario
        self.model = config["models"][model_id]
        self.thresholds = thresholds(self.model)
        caps = scenario.caps if scenario.caps is not None else self.model["caps"]
        self.ledger = Ledger(self.thresholds[-1], caps["general"], caps["skill"])
        self.gates = config["gates"][scenario.gates or self.model["gate_policy"]]
        self.level = {s: 0 for s in SKILLS}
        self.practice = {s: 0 for s in SKILLS}
        self.qual_minutes: dict[tuple[str, int], int] = defaultdict(int)
        self.intro_done: set[str] = set()
        self.used: dict[tuple[str, str], int] = defaultdict(int)
        self.active_days = self.minutes_used = self.qualification_minutes = self.paid_completions = 0
        self.skill_minutes = {s: 0 for s in SKILLS}
        self.milestones: dict[tuple[str, int], dict] = {}
        self.ready_day: int | None = None
        self.goal_day: int | None = None
        self.day = self.sequence = 0
        self.day_minutes = 0
        self.expert_attempts = 0
        self.history: list[dict] = []
        self.last_active: int | None = None
        self.bonus_remaining = 0
        self.bonus_used = False

    def attending(self, day: int) -> bool:
        if day < self.scenario.start_day:
            return False
        if self.scenario.attendance == "irregular":
            return (day - 1) % 7 in (0, 2, 5)  # Fixed three days/week; deterministic, not random behavior.
        if self.scenario.attendance == "break":
            return not 15 <= day <= 28
        if self.scenario.attendance == "long_break":
            return not 31 <= day <= 90
        return True

    def gate_ok(self, skill: str, level: int) -> bool:
        rule = self.gates.get(str(level), {})
        if self.scenario.no_qualifications and rule:
            return False
        return self.practice[skill] >= rule.get("practice", 0) and self.qual_minutes[skill, level] >= rule.get("minutes", 0)

    def update_levels(self) -> None:
        for skill in SKILLS:
            while self.level[skill] < 10:
                nxt = self.level[skill] + 1
                if self.ledger.xp[skill] < self.thresholds[nxt] or not self.gate_ok(skill, nxt):
                    break
                self.level[skill] = nxt
                if nxt in MILESTONES:
                    self.milestones[skill, nxt] = {"day": self.day, "active_days": self.active_days,
                        "minutes": self.minutes_used, "skill_minutes": self.skill_minutes[skill]}
        if self.ready_day is None and self.level["business"] >= 5 and self.level["plumbing"] >= 3:
            self.ready_day = self.day

    def owner_ready(self) -> bool:
        return all(self.level[s] >= value for s, value in self.config["paid_access_assumption"].items())

    def event(self, skill: str, kind: str, minutes: int, xp: int, *, qualification: int | None = None) -> None:
        self.sequence += 1
        self.minutes_used += minutes
        self.day_minutes += minutes
        self.skill_minutes[skill] += minutes
        self.used[skill, kind] += 1
        before = self.level[skill]
        verified = True
        if kind in ("practice", "paid", "qualification", "management"):
            self.expert_attempts += 1
            verified = not self.scenario.failure_every or self.expert_attempts % self.scenario.failure_every != 0
        bonus = self.config["rested_sensitivity"]["extra_percent"] if self.bonus_remaining else 0
        proposed = xp + xp * bonus // 100
        policy = self.scenario.multi or self.model["multi_policy"]
        allocations = {skill: proposed}
        if kind == "paid" and policy in ("conserved_split", "additive_split"):
            if policy == "conserved_split":
                allocations = apportion(proposed, {"plumbing": self.config["split_policy"]["main_percent"],
                    "business": self.config["split_policy"]["side_percent"]})
            else:
                allocations = {"plumbing": proposed, "business": proposed * self.config["split_policy"]["side_percent"] // 100}
        stamp = datetime.combine(date.fromisoformat(self.config["reference_date"]) + timedelta(days=self.day - 1), time(9), TURKEY)
        receipt = self.ledger.award(f"synthetic:{self.scenario.name}:{self.day}:{self.sequence}", allocations,
                                    stamp + timedelta(minutes=self.day_minutes), verified=verified)
        if receipt.new:
            if kind == "practice" and before >= 6:
                self.practice[skill] += 1
            if kind == "qualification":
                self.qual_minutes[skill, qualification] += minutes
            if kind == "paid":
                self.paid_completions += 1
        self.update_levels()

    def segment(self, skill: str, minutes: int) -> None:
        if skill in self.scenario.inaccessible:
            return
        remaining = minutes
        if self.scenario.free_intro and skill not in self.intro_done and remaining >= 5:
            self.event(skill, "intro", 5, self.model["xp"]["intro"])
            self.intro_done.add(skill)
            remaining -= 5
        # Optional qualifications are chunkable; advanced practice uses an actual verified activity event.
        for target, rule in sorted(self.gates.items(), key=lambda item: int(item[0])):
            target = int(target)
            if self.level[skill] < target - 1 or self.gate_ok(skill, target) or self.scenario.no_qualifications:
                continue
            while rule.get("practice", 0) > self.practice[skill] and remaining >= 10 and self.used[skill, "practice"] < self.config["activities"]["practice"]["daily_max"]:
                self.event(skill, "practice", 10, self.model["xp"]["practice"])
                remaining -= 10
            needed = rule.get("minutes", 0) - self.qual_minutes[skill, target]
            while needed > 0 and remaining >= 5:
                chunk = min(needed, remaining) // 5 * 5
                self.qualification_minutes += chunk
                self.event(skill, "qualification", chunk, 0, qualification=target)
                remaining -= chunk
                needed = rule.get("minutes", 0) - self.qual_minutes[skill, target]
        if self.ledger.xp[skill] >= self.thresholds[-1]:
            return
        kinds = ["course", "book", "practice"]
        if self.scenario.paid and self.owner_ready():
            if skill == "plumbing":
                kinds.append("paid")
            if skill == "business" and (self.scenario.multi or self.model["multi_policy"]) == "separate_management":
                kinds.append("management")
        items = tuple((kind, self.config["activities"][kind]["minutes"], self.model["xp"][kind],
                       max(0, self.config["activities"][kind]["daily_max"] - self.used[skill, kind])) for kind in sorted(kinds))
        for kind in best_plan(remaining, items):
            if self.ledger.xp[skill] >= self.thresholds[-1]:
                break
            self.event(skill, kind, self.config["activities"][kind]["minutes"], self.model["xp"][kind])

    def allocations(self, budget: int) -> dict[str, int]:
        unfinished = [s for s in self.scenario.targets if self.level[s] < self.scenario.goals.get(s, 10)]
        if not unfinished:
            return {}
        mode = self.scenario.allocation
        if mode == "serial":
            return {unfinished[0]: budget}
        if mode == "alternate" or (mode == "adaptive" and budget < 30):
            return {unfinished[(self.active_days - 1) % len(unfinished)]: budget}
        # Rotate execution order so a general cap does not systematically favor the same skill.
        order = unfinished[(self.active_days - 1) % len(unfinished):] + unfinished[:(self.active_days - 1) % len(unfinished)]
        ticks, rest = divmod(budget // 5, len(order))
        return {s: (ticks + (i < rest)) * 5 for i, s in enumerate(order)}

    def run(self, days: int, *, record_until: int = 180, stop_when_complete: bool = False) -> "Simulation":
        for day in range(1, days + 1):
            self.day = day
            self.day_minutes = 0
            active = self.attending(day)
            if active:
                if self.scenario.rested_bonus and self.last_active is not None and day - self.last_active >= 8 and not self.bonus_used:
                    self.bonus_remaining = self.config["rested_sensitivity"]["active_days"]
                    self.bonus_used = True
                self.active_days += 1
                self.used.clear()
                for skill, minutes in self.allocations(self.minutes).items():
                    self.segment(skill, minutes)
                self.last_active = day
                self.bonus_remaining = max(0, self.bonus_remaining - 1)
                if self.goal_day is None and all(self.level[s] >= self.scenario.goals.get(s, 10) for s in self.scenario.targets):
                    self.goal_day = day
            if day <= record_until:
                row = {"scenario": self.scenario.name, "model": self.model_id, "minutes_per_active_day": self.minutes,
                    "day": day, "active": active, "active_days": self.active_days, "study_minutes": self.minutes_used,
                    "qualification_minutes": self.qualification_minutes, "raw_verified_xp": self.ledger.raw,
                    "credited_xp": self.ledger.credited, "cap_lost_xp": self.ledger.cap_lost,
                    "max_lost_xp": self.ledger.max_lost, "failed_potential_xp": self.ledger.failed,
                    "paid_completions": self.paid_completions, "ready_day": self.ready_day, "goal_day": self.goal_day}
                for s in SKILLS:
                    row[s + "_level"] = self.level[s]
                    row[s + "_xp"] = self.ledger.xp[s]
                    row[s + "_gate_blocked"] = self.level[s] < 10 and self.ledger.xp[s] >= self.thresholds[self.level[s] + 1]
                self.history.append(row)
            if stop_when_complete and self.goal_day is not None and day >= record_until:
                break
        return self
