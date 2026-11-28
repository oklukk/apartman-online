"""Export finite learning research. No production imports, network or database access."""
from dataclasses import asdict
import argparse
import csv
import hashlib
import json
from pathlib import Path
import tempfile

from calendar_sim import CalendarSimulation, Case, FIELDS, offerings
from study import table, write_csv

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'docs/game-systems-stage1/xp-balance-study/calendar'


def cases():
    return [Case('single_plumbing'), Case('single_business', ('business',)), Case('dual', FIELDS),
            Case('irregular', FIELDS, attendance='irregular'), Case('break14', FIELDS, attendance='break14'),
            Case('failure20', FIELDS, failure_every=5), Case('pilot_only', expert_available=False),
            Case('crowded12', cohort=12), Case('capacity_double', capacity_multiplier=2),
            Case('solo', cohort=1), Case('missed_no_makeup', attendance='irregular', no_makeup=True), Case('low_demand', needs_per_week=2)]


def build(base, cfg, out):
    out.mkdir(parents=True, exist_ok=True)
    snapshots, milestones, waiting, stories, events, daily = [], [], [], [], [], []
    sims = {}
    for calendar in cfg['calendars']:
        for case in cases():
            for minutes in cfg['minutes']:
                sim = CalendarSimulation(base, cfg, calendar, minutes, case).run(cfg['horizon'])
                p = sim.probe
                sims[calendar, case.name, minutes] = sim
                for d in cfg['snapshots']:
                    snapshots.append(p.history[d-1])
                for field in case.targets:
                    for level in (3, 5, 7, 10):
                        hit = p.level_hits.get((field, level), {})
                        milestones.append({'calendar': calendar, 'case': case.name, 'minutes': minutes, 'field': field,
                            'level': level, 'calendar_day': hit.get('day'), 'active_days': hit.get('active_days'),
                            'active_work_minutes': hit.get('minutes'), 'horizon': cfg['horizon']})
                waiting.append({'calendar': calendar, 'case': case.name, 'minutes': minutes,
                    **{k:p.reasons[k] for k in ('zero_xp_active_days', 'no_work_active_days', 'unused_minutes',
                        'instructor_capacity', 'calendar_closed', 'daily_right', 'weekly_right', 'prerequisite',
                        'expert_unavailable', 'retry_limit', 'xp_cap', 'phase_ceiling')},
                    **{'idle_minutes_' + k:p.reasons['idle_minutes_' + k] for k in ('instructor_capacity', 'calendar_closed', 'daily_right',
                        'weekly_right', 'prerequisite', 'expert_unavailable', 'retry_limit', 'content_exhausted', 'no_time', 'other')}})
                if case.name in ('single_plumbing', 'single_business', 'dual'):
                    daily.extend(p.history)
                if calendar == 'B' and case.name in ('single_plumbing', 'single_business', 'irregular'):
                    stories.extend(p.history[:14]); events.extend({'calendar': calendar, 'case': case.name, 'minutes': minutes, **e} for e in p.events)
    ablations = []
    for calendar in cfg['calendars']:
        for minutes in (15, 30, 120):
            for name, toggles in [('full', {}), ('no_timing', {'always_open':True}), ('no_seat_capacity', {'unlimited_capacity':True}),
                 ('no_daily_weekly_rights', {'no_rights':True}), ('no_qualifications', {'no_gates':True}),
                 ('no_xp_caps', {'no_xp_caps':True}), ('short_windows', {'no_makeup':True})]:
                sim = CalendarSimulation(base, cfg, calendar, minutes, Case(name, **toggles)).run(cfg['horizon'])
                p = sim.probe
                ablations.append({'calendar':calendar, 'minutes': minutes, 'variant':name,
                    **{'level'+str(l)+'_day':p.level_hits.get(('plumbing',l),{}).get('day') for l in (3,5,7,10)},
                    'level180':p.history[179]['plumbing_level'], 'xp180':p.history[179]['credited_xp'],
                    'work_minutes180':p.history[179]['study_minutes'], 'idle_minutes180':p.reasons['unused_minutes'],
                    'no_work_days180':p.reasons['no_work_active_days']})
    phase = []
    # Entry weekday matters; no cherry-picked Monday-only conclusion.
    for calendar in cfg['calendars']:
        for offset in range(7):
            sim = CalendarSimulation(base, cfg, calendar, 30, Case('weekday', start_offset=offset)).run(cfg['horizon'])
            p = sim.probe
            phase.append({'calendar':calendar, 'start_offset':offset,
                          **{'level'+str(l)+'_days_after_entry': (p.level_hits['plumbing',l]['day']-offset) if ('plumbing',l) in p.level_hits else None for l in (3,5,7,10)}})
    starter = []
    for calendar in cfg['calendars']:
        for minutes in cfg['minutes']:
            for duration, reward in ((15,24),(5,24),(15,32),(5,32)):
                sim=CalendarSimulation(base,cfg,calendar,minutes,Case('starter',starter_minutes=duration,starter_xp=reward)).run(30,record_until=30)
                hit=sim.probe.level_hits.get(('plumbing',3),{})
                starter.append({'calendar':calendar,'minutes':minutes,'module_minutes':duration,'module_xp':reward,
                                'level3_day':hit.get('day'),'level3_work_minutes':hit.get('minutes')})
    availability = []
    reference=__import__('datetime').date.fromisoformat(cfg['reference_date'])
    for calendar, schedule in cfg['calendars'].items():
        for kind in ('middle','expert','project'):
            dates=set(); longest=run=steady=0
            for n in range(112):
                day=reference+__import__('datetime').timedelta(days=n)
                slots=offerings(cfg,schedule,'plumbing',kind,day)
                dates.update(o.opens for o in slots)
                run=run+1 if not slots else 0;longest=max(longest,run)
                if n>=28: steady=max(steady,run)
            ordered=sorted(dates)
            gap=max((b-a).days for a,b in zip(ordered,ordered[1:]))
            availability.append({'calendar':calendar,'kind':kind,'max_days_between_releases':gap,'max_closed_days_including_startup':longest,'steady_max_closed_days':steady,
                                 'capacity_guarantee':False})
    start_paths=[]
    for skill in base['skills']:
        sim=CalendarSimulation(base,cfg,'B',15,Case('start_path',targets=(skill,),cohort=1)).run(30,record_until=30)
        p=sim.probe
        start_paths.append({'skill':skill,'level3_day':p.level_hits.get((skill,3),{}).get('day'),
                            'level30':p.level[skill],'pilot_middle_instructor':skill in cfg['pilot_instructors']})
    fast=CalendarSimulation(base,cfg,'B',15,Case('starter_fast',starter_minutes=5,starter_xp=32)).run(14,record_until=14)
    exports = {'snapshots':snapshots,'milestones':milestones,'waiting':waiting,'first14':stories,'first14_events':events,
               'daily':daily,'ablations':ablations,'start_weekday':phase,'starter_sensitivity':starter,'availability':availability,'start_paths':start_paths,'starter_first14':fast.probe.history}
    for name, rows in exports.items(): write_csv(out/(name+'.csv'), rows)
    (out/'manifest.json').write_text(json.dumps({'notice':cfg['notice'], 'base_xp_model':'B; unchanged config.json',
        'base_sha256':hashlib.sha256(json.dumps(base,sort_keys=True).encode()).hexdigest(),
        'calendar_config_sha256':hashlib.sha256(json.dumps(cfg,sort_keys=True).encode()).hexdigest(),
        'cases':[asdict(c) for c in cases()], 'row_counts':{k:len(v) for k,v in exports.items()}},ensure_ascii=False,indent=2)+'\n')
    lines = ['# Sınırlı öğrenme sayısal eki — öneri / simülasyon varsayımı\n',
        'XP paketi B bütün satırlarda aynıdır. Takvim A/B/C ayrı boyuttur. 180 sonrası değerler 1460 gün ufkunda hesaplanır. Boş = ufukta ulaşılmadı; kazanılmış XP değildir.\n']
    for c in cfg['calendars']:
        lines += [f'## Takvim {c}: tek Tesisatçılık\n',table(['dk/gün','L3 gün / dk','L5 gün / dk','L7 gün / dk','L10 gün / dk','Seviye@180','XP@180'],
            [[m]+[f"{sims[c,'single_plumbing',m].probe.level_hits.get(('plumbing',l),{}).get('day','—')} / {sims[c,'single_plumbing',m].probe.level_hits.get(('plumbing',l),{}).get('minutes','—')}" for l in (3,5,7,10)]+
             [sims[c,'single_plumbing',m].probe.history[179]['plumbing_level'],sims[c,'single_plumbing',m].probe.history[179]['credited_xp']] for m in cfg['minutes']]),'']
        lines += [f'## Takvim {c}: İşletmecilik5 ve iki alan\n',table(['dk','Tek İşletmecilik5 gün','Çift alanda İşletmecilik5 gün','7g T/B','14g T/B','30g T/B','60g T/B','90g T/B','180g T/B'],
            [[m,sims[c,'single_business',m].probe.level_hits.get(('business',5),{}).get('day'),sims[c,'dual',m].probe.level_hits.get(('business',5),{}).get('day')]+
             [str(sims[c,'dual',m].probe.history[d-1]['plumbing_level'])+'/'+str(sims[c,'dual',m].probe.history[d-1]['business_level']) for d in cfg['snapshots']] for m in cfg['minutes']]),'']
    lines += ['## Bekleme: ilk 180 gün, tek alan\n','Kısıt günleri çakışabilir; sıfır XP günü her zaman boş bekleme değildir. Kullanılmayan dakika, ayrılmış öğrenme bütçesidir; uygulamada bekleme zorunluluğu değildir.\n',
        table(['Takvim','dk','Sıfır XP aktif gün','Hiç çalışma olmayan aktif gün','Kullanılmayan dk','Kapasite kısıt günü','Kapalı takvim günü','Günlük hak günü','Haftalık hak günü'],
            [[r[k] for k in ('calendar','minutes','zero_xp_active_days','no_work_active_days','unused_minutes','instructor_capacity','calendar_closed','daily_right','weekly_right')] for r in waiting if r['case']=='single_plumbing']),'',
        '## Tek değişkenli ayrıştırma (30 dk)\n',table(list(ablations[0]),[list(r.values()) for r in ablations if r['minutes']==30]),'']
    (out/'TABLES.md').write_text('\n'.join(lines))
    return sims


def main():
    parser=argparse.ArgumentParser(description='OFFLINE finite learning research only')
    parser.add_argument('--config',type=Path,default=HERE/'calendar-config.json')
    parser.add_argument('--out',type=Path,default=OUT)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    base=json.loads((HERE/'config.json').read_text()); cfg=json.loads(args.config.read_text())
    if args.check:
        with tempfile.TemporaryDirectory(prefix='apartman-calendar-') as temp:
            build(base,cfg,Path(temp))
            for path in Path(temp).iterdir():
                if not (args.out/path.name).exists() or (args.out/path.name).read_bytes()!=path.read_bytes():
                    raise SystemExit('MISMATCH '+path.name)
        print('PASS calendar CSV/JSON/Markdown byte reproduction')
    else:
        build(base,cfg,args.out)
        print('OFFLINE finite-calendar proposals generated:',args.out)


if __name__=='__main__': main()
