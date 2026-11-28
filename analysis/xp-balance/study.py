"""Generate deterministic proposal CSV/Markdown. No production configuration is edited."""
from __future__ import annotations

import argparse
from dataclasses import asdict
import csv
import hashlib
import json
from pathlib import Path
import tempfile

from simulate import Scenario, Simulation, normalized_steps, steps, thresholds

HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE.parents[1] / "docs/game-systems-stage1/xp-balance-study"


def scenarios() -> list[Scenario]:
    dual = ("plumbing", "business")
    return [
        Scenario("single_plumbing"), Scenario("single_business", ("business",)),
        Scenario("dual", dual), Scenario("dual_alternate", dual, allocation="alternate"),
        Scenario("business_first", ("business", "plumbing"), goals={"business": 5, "plumbing": 3}, allocation="serial"),
        Scenario("irregular", dual, attendance="irregular"), Scenario("break14", dual, attendance="break"),
        Scenario("return_bonus", dual, attendance="break", rested_bonus=True),
        Scenario("break60", dual, attendance="long_break"),
        Scenario("newcomer30", dual, start_day=31), Scenario("paid_access", dual, paid=True),
        Scenario("professor_path", ("basic_teaching", "advanced_teaching", "plumbing"),
                 goals={"basic_teaching": 10, "advanced_teaching": 5, "plumbing": 6}),
        Scenario("business_unavailable", dual, inaccessible=("business",)),
        Scenario("qualifications_unavailable", no_qualifications=True),
        Scenario("failure20", dual, failure_every=5),
    ]


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        fields = list(rows[0]) if rows else []
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def table(headers: list[str], rows: list[list]) -> str:
    def fmt(value):
        return "—" if value is None else str(value)
    return "\n".join(["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"] +
                     ["| " + " | ".join(map(fmt, row)) + " |" for row in rows])


def build(config: dict, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    curves, snapshots, milestone_rows, daily = [], [], [], []
    results: dict[tuple, Simulation] = {}
    for model_id, model in config["models"].items():
        cost, totals = steps(model), thresholds(model)
        normalized = normalized_steps(model, config["normalized_curve_total"])
        accum = 0
        for level in range(0, 11):
            if level:
                accum += normalized[level - 1]
            curves.append({"model": model_id, "level": level, "step_xp": cost[level - 1] if level else 0,
                           "total_xp": totals[level], "normalized_step_xp": normalized[level - 1] if level else 0,
                           "normalized_total_xp": accum})
        for scenario in scenarios():
            for minutes in config["profiles_minutes"]:
                horizon = 180 if scenario.name in ("business_unavailable", "qualifications_unavailable") else config["milestone_horizon"]
                sim = Simulation(config, model_id, minutes, scenario).run(horizon, stop_when_complete=True)
                results[model_id, scenario.name, minutes] = sim
                for day in config["report_days"]:
                    snapshots.append(sim.history[day - 1])
                if scenario.name in ("single_plumbing", "single_business", "dual") or (
                    model_id == "B" and minutes == 30 and scenario.name in ("irregular", "break14", "break60", "return_bonus", "newcomer30")):
                    daily.extend(sim.history)
                for skill in scenario.targets:
                    for level in (1, 3, 5, 7, 10):
                        hit = sim.milestones.get((skill, level), {})
                        milestone_rows.append({"model": model_id, "scenario": scenario.name, "minutes_per_active_day": minutes,
                            "skill": skill, "level": level, "calendar_day": hit.get("day"),
                            "active_days": hit.get("active_days"), "total_study_minutes": hit.get("minutes"),
                            "target_skill_minutes": hit.get("skill_minutes"), "observed_horizon_days": horizon})
    write_csv(out / "curves.csv", curves)
    write_csv(out / "snapshots.csv", snapshots)
    write_csv(out / "milestones.csv", milestone_rows)
    write_csv(out / "daily.csv", daily)

    # Equal-model sensitivity: hold curve/rewards fixed (B), vary one rule at a time.
    sensitivity = []
    for minutes in config["profiles_minutes"]:
        for policy in config["gates"]:
            s = Scenario("gate_" + policy, gates=policy)
            sim = Simulation(config, "B", minutes, s).run(config["milestone_horizon"], stop_when_complete=True)
            row = sim.history[179]
            sensitivity.append({"family": "expertise", "variant": policy, "minutes": minutes,
                "credited_xp_180": row["credited_xp"], "cap_lost_180": row["cap_lost_xp"], "plumbing_level_180": row["plumbing_level"],
                "business_level_180": row["business_level"], "plumbing7_day": sim.milestones.get(("plumbing", 7), {}).get("day"),
                "plumbing10_day": sim.milestones.get(("plumbing", 10), {}).get("day"), "paid_completions_180": row["paid_completions"]})
        for policy in ("main_only", "conserved_split", "separate_management", "additive_split"):
            s = Scenario("multi_" + policy, ("plumbing", "business"), paid=True, multi=policy)
            sim = Simulation(config, "B", minutes, s).run(config["milestone_horizon"], stop_when_complete=True)
            row = sim.history[179]
            sensitivity.append({"family": "multi_skill", "variant": policy, "minutes": minutes,
                "credited_xp_180": row["credited_xp"], "cap_lost_180": row["cap_lost_xp"], "plumbing_level_180": row["plumbing_level"],
                "business_level_180": row["business_level"], "plumbing7_day": sim.milestones.get(("plumbing", 7), {}).get("day"),
                "plumbing10_day": sim.milestones.get(("plumbing", 10), {}).get("day"), "paid_completions_180": row["paid_completions"]})
    write_csv(out / "sensitivity.csv", sensitivity)

    cap_rows = []
    for scope, targets in [("single_skill", ("plumbing",)), ("four_skills", tuple(config["skills"]))]:
        for name, caps in [("general", {"general": 110, "skill": None}), ("skill", {"general": None, "skill": 70}),
                           ("combined", {"general": 110, "skill": 70})]:
            sim = Simulation(config, "B", 180, Scenario("cap_" + name, targets, caps=caps, gates="xp_only")).run(2, record_until=2)
            before, after = sim.history
            cap_rows.append({"scope": scope, "cap_policy": name,
                "raw_xp_day2": after["raw_verified_xp"] - before["raw_verified_xp"],
                "credited_day2": after["credited_xp"] - before["credited_xp"],
                "cap_lost_day2": after["cap_lost_xp"] - before["cap_lost_xp"]})
    write_csv(out / "cap_comparison.csv", cap_rows)

    # ±25% base rewards and target-skill daily cap sensitivity for the recommended package.
    tuning = []
    for reward_pct in (75, 100, 125):
        for cap_pct in (75, 100, 125):
            candidate = json.loads(json.dumps(config))
            b = candidate["models"]["B"]
            b["xp"] = {k: v * reward_pct // 100 for k, v in b["xp"].items()}
            b["caps"] = {k: v * cap_pct // 100 for k, v in b["caps"].items()}
            for minutes in (15, 30, 60):
                sim = Simulation(candidate, "B", minutes, Scenario("tuning", ("plumbing", "business"))).run(config["milestone_horizon"], stop_when_complete=True)
                tuning.append({"reward_percent": reward_pct, "cap_percent": cap_pct, "minutes": minutes,
                    "business5_day": sim.milestones.get(("business", 5), {}).get("day"),
                    "plumbing10_day": sim.milestones.get(("plumbing", 10), {}).get("day"), "ready_day": sim.ready_day})
    write_csv(out / "tuning.csv", tuning)

    long_sessions = []
    for model_id in config["models"]:
        for minutes in (180, 240, 360):
            for name, targets in (("single", ("plumbing",)), ("dual", ("plumbing", "business"))):
                sim = Simulation(config, model_id, minutes, Scenario("long_session", targets)).run(config["milestone_horizon"], stop_when_complete=True)
                long_sessions.append({"model": model_id, "minutes": minutes, "scope": name,
                    "plumbing10_day": sim.milestones.get(("plumbing", 10), {}).get("day"),
                    "both10_day": sim.goal_day, "credited_xp_180": sim.history[179]["credited_xp"],
                    "cap_lost_180": sim.history[179]["cap_lost_xp"]})
    write_csv(out / "long_sessions.csv", long_sessions)

    summary = {}
    for model in config["models"]:
        summary[model] = {}
        for minutes in config["profiles_minutes"]:
            single = results[model, "single_plumbing", minutes]
            business = results[model, "single_business", minutes]
            dual = results[model, "dual", minutes]
            serial = results[model, "business_first", minutes]
            summary[model][str(minutes)] = {
                "single_level_days": {str(level): single.milestones.get(("plumbing", level), {}).get("day") for level in (1, 3, 5, 7, 10)},
                "single_work_minutes": {str(level): single.milestones.get(("plumbing", level), {}).get("skill_minutes") for level in (1, 3, 5, 7, 10)},
                "single_business5": business.milestones.get(("business", 5), {}).get("day"),
                "dual_business5": dual.milestones.get(("business", 5), {}).get("day"),
                "dual_both10": dual.goal_day, "dual_ready": dual.ready_day, "business_first_ready": serial.ready_day,
                "dual_180": dual.history[179], "single_180": single.history[179],
            }
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {"notice": config["notice"], "base_commit": config["base_commit"],
        "config_sha256": hashlib.sha256(json.dumps(config, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
        "scenario_definitions": [asdict(s) for s in scenarios()], "csv_rows": {
            "curves": len(curves), "snapshots": len(snapshots), "milestones": len(milestone_rows), "daily": len(daily),
            "sensitivity": len(sensitivity), "cap_comparison": len(cap_rows), "tuning": len(tuning), "long_sessions": len(long_sessions)}}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tables = ["# Sayısal ek — bütün değerler öneri / simülasyon varsayımıdır\n",
              "Bu dosya `study.py` tarafından config.json'dan üretilir; üretim kuralı değildir.\n"]
    for model_id in config["models"]:
        tables += [f"## Model {model_id}: kademelik ve toplam XP\n",
            table(["Seviye", "Kademe XP", "Toplam XP", "3600 toplamda kademe", "3600 toplamda birikimli"],
                  [[r["level"], r["step_xp"], r["total_xp"], r["normalized_step_xp"], r["normalized_total_xp"]] for r in curves if r["model"] == model_id]), ""]
        tables += [f"## Model {model_id}: tek yetenekte kilometre taşları\n",
            "Günler kayıt başlangıcından itibaren takvim günüdür; bütün günler aktiftir. 180 sonrası değerler 1460 güne uzatılmış aynı simülasyondan gelir.\n",
            table(["dk/gün", "L1 gün", "L3 gün", "L5 gün", "L7 gün", "L10 gün", "L10 çalışma dk"],
                [[m] + [summary[model_id][str(m)]["single_level_days"][str(level)] for level in (1, 3, 5, 7, 10)] +
                 [summary[model_id][str(m)]["single_work_minutes"]["10"]] for m in config["profiles_minutes"]]), "",
            f"## Model {model_id}: çift yetenek (Tesisat / İşletmecilik)\n",
            "<30dk günler tek alana dönüşümlü; ≥30dk eşit 5 dk bloklarıyla bölünür. Aynı gün işlem sırası dönüşümlüdür.\n",
            table(["dk", "7g", "14g", "30g", "60g", "90g", "180g", "İşletme5 gün", "İki L10 gün", "Hazırlık gün", "Önce İşletme hazır gün"],
                [[m] + [f"{results[model_id,'dual',m].history[d-1]['plumbing_level']}/{results[model_id,'dual',m].history[d-1]['business_level']}" for d in config["report_days"]] +
                 [summary[model_id][str(m)][k] for k in ("dual_business5", "dual_both10", "dual_ready", "business_first_ready")] for m in config["profiles_minutes"]]), "",
            f"## Model {model_id}: tek yetenek 180g tavan etkisi\n",
            table(["dk", "Doğrulanmış potansiyel XP", "Verilen XP", "Tavan nedeniyle verilmeyen", "L10 taşması", "Düzenli çalışma dk"],
                [[m] + [summary[model_id][str(m)]["single_180"][k] for k in ("raw_verified_xp", "credited_xp", "cap_lost_xp", "max_lost_xp", "study_minutes")] for m in config["profiles_minutes"]]), ""]
    tables += ["## Model B: düzensiz / mola / yeni katılım (30dk, çift yetenek)\n",
        table(["Senaryo", "30g", "60g", "90g", "180g", "180g XP", "180g çalışma dk"],
            [[name] + [f"{results['B',name,30].history[d-1]['plumbing_level']}/{results['B',name,30].history[d-1]['business_level']}" for d in (30,60,90,180)] +
             [results['B',name,30].history[179][k] for k in ('credited_xp','study_minutes')]
             for name in ('dual','irregular','break14','break60','return_bonus','newcomer30','failure20','business_unavailable')]), "",
        "## Model B 180dk: tavan türü ve alan değiştirme (ikinci aktif gün)\n",
        table(list(cap_rows[0]), [list(row.values()) for row in cap_rows]), "",
        "## Model B: üst seviye şartını tek başına değiştirme\n",
        table(["Şart", "dk", "L7 gün", "L10 gün", "180g L"], [[r['variant'],r['minutes'],r['plumbing7_day'],r['plumbing10_day'],r['plumbing_level_180']] for r in sensitivity if r['family']=='expertise']), "",
        "## Model B: ücretli hizmet sonrası çoklu yetenek varsayımı\n",
        "Ücretli işler ancak varsayımsal Tesisat3+İşletmecilik5 sonrası ve doğrulanmış talep varsa açılır; mevcut oyunda açık değildir.\n",
        table(["Politika", "dk", "180g T/B", "180g toplam XP", "Ücretli iş", "Tesisat L10 gün"],
              [[r['variant'],r['minutes'],f"{r['plumbing_level_180']}/{r['business_level_180']}",r['credited_xp_180'],r['paid_completions_180'],r['plumbing10_day']] for r in sensitivity if r['family']=='multi_skill']), ""]
    (out / "TABLES.md").write_text("\n".join(tables), encoding="utf-8")
    return {"results": results, "summary": summary, "curves": curves, "caps": cap_rows, "sensitivity": sensitivity, "tuning": tuning}


def main():
    parser = argparse.ArgumentParser(description="OFFLINE balance proposals; no game/DB mutation")
    parser.add_argument("--config", type=Path, default=HERE / "config.json")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--check", action="store_true", help="Compare deterministic text artifacts without overwriting them")
    parser.add_argument("--figures", action="store_true", help="Optional local matplotlib export; no npm dependency")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    if args.check:
        with tempfile.TemporaryDirectory(prefix="apartman-xp-study-") as directory:
            temp = Path(directory)
            build(config, temp)
            for path in sorted(temp.iterdir()):
                expected = args.out / path.name
                if not expected.exists() or expected.read_bytes() != path.read_bytes():
                    raise SystemExit("MISMATCH: " + path.name)
        print("PASS deterministic CSV/JSON/Markdown artifacts")
    else:
        data = build(config, args.out)
        if args.figures:
            from render import render
            render(args.out)
        print("OFFLINE proposals generated:", args.out)


if __name__ == "__main__":
    main()
