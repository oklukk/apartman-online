"""B+ study exports; stdlib, finite fixtures, no application/network/database imports."""
import argparse
from collections import Counter
from copy import deepcopy
from datetime import date,timedelta
import hashlib
import json
from pathlib import Path
import tempfile

from bplus_sim import BPlusSimulation
from calendar_sim import CalendarSimulation,Case,FIELDS
from study import table,write_csv

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/game-systems-stage1/xp-balance-study/bplus'


def nonxp_metrics(history,minutes,scenario):
    """Hypothetical opportunities, not a retention/actual meaningfulness measurement.

    Existing chat/poll CAPABILITY does not imply actual fresh content. Explicit,
    finite community-event fixtures; no reward for login or for these actions.
    """
    events=[]
    peer_days=(0,3) if scenario=='sparse_existing' else (0,2,4,6)
    for week in range(26):
        for weekday in peer_days:
            start=week*7+weekday+1
            events.append((f'peer-thread:{week}:{weekday}',start,start+3,10,'existing_capability_fixture'))
        if scenario=='community_proposed':
            start=week*7+6
            events.append((f'weekly-plan:{week}',start,start+3,15,'new_mechanic_proposal'))
    for period in range(7):
        start=period*28+10
        events.append((f'poll:{period}',start,start+1,5,'existing_capability_fixture'))
    completed=set();no_opportunity=0;minutes_used=0
    learning_empty=0;active=0
    for row in history:
        if not row['active']:continue
        active+=1
        spare=minutes-row['day_study_minutes'];spent=0
        for source,opens,closes,cost,classification in events:
            if opens<=row['day']<closes and source not in completed and cost<=spare:
                spare-=cost;spent+=cost;completed.add(source)
        minutes_used+=spent
        if row['day_study_minutes']==0:
            learning_empty+=1
            if not spent:no_opportunity+=1
    return {'social_scenario':scenario,'active_days':active,'no_learning_full180':learning_empty,
            'no_modeled_learning_or_community_days':no_opportunity,'community_minutes':minutes_used,
            'community_events':len(completed),'actual_no_meaningful_activity_days':'UNKNOWN'}


def make(base,cfg,proposal,name,minutes,case,library=None):
    case=deepcopy(case)
    if name in ('A_reference','B_original','C_reference','B_short'):
        calendar='A'if name=='A_reference'else('C'if name=='C_reference'else'B')
        sim=CalendarSimulation(base,cfg,calendar,minutes,case)
        if name=='B_short':
            for p in sim.learners:p.case.starter_minutes=proposal['starter_minutes'];p.case.starter_xp=proposal['starter_xp']
    else:sim=BPlusSimulation(base,cfg,proposal,name,minutes,case,library=library)
    return sim.run(proposal['horizon'])


def build(base,cfg,proposal,out):
    out.mkdir(parents=True,exist_ok=True)
    rows=[];milestones=[];snapshots=[];daily=[];social=[];sources=[];capacities=[]
    all_sims={}
    scenarios=[Case('single'),Case('business',targets=('business',)),Case('dual',targets=FIELDS),
               Case('irregular',targets=FIELDS,attendance='irregular'),Case('break14',targets=FIELDS,attendance='break14'),
               Case('class12',cohort=12),Case('class12_dual',targets=FIELDS,cohort=12),
               Case('pilot_only',expert_available=False),Case('library64')]
    for case in scenarios:
        variants=['B_original','B_short','Bplus_paced','Bplus','Bplus_expiring']
        if case.name=='single':variants=['A_reference','C_reference','B_original','B_short',*proposal['variants']]
        if case.name in ('class12','pilot_only','library64'):variants=['B_original','B_short','Bplus_paced']
        if case.name in ('class12_dual',):variants=['B_short','Bplus_paced']
        if case.name in ('dual','irregular'):variants += ['paced_no_selfstudy','paced_no_queue']
        if case.name=='library64':variants=['Bplus_paced']
        variants=list(dict.fromkeys([*variants,'paced_no_selfstudy']))
        for variant in variants:
            for minutes in proposal['minutes']:
                sim=make(base,cfg,proposal,variant,minutes,case,64 if case.name=='library64'else None)
                p=sim.probe
                all_sims[variant,case.name,minutes]=sim
                full=sum(r['active']and r['day_study_minutes']==0 for r in p.history)
                denials=getattr(sim,'denials',set())
                d0=date.fromisoformat(cfg['reference_date'])
                filtered=[d for d in denials if d[0]==p.key and 0<=(d[1]-d0).days<180]
                row={'variant':variant,'case':case.name,'minutes':minutes,
                    **{'level'+str(l)+'_day':p.level_hits.get((case.targets[0],l),{}).get('day')for l in(3,5,7,10)},
                    'business5_day':p.level_hits.get(('business',5),{}).get('day'),
                    'both10_day':max((p.level_hits.get((f,10),{}).get('day')or proposal['horizon']+1)for f in case.targets),
                    'no_learning_pre_mastery180':p.reasons['no_work_active_days'],
                    'no_learning_full180':full,'after_mastery_no_learning180':full-p.reasons['no_work_active_days'],
                    'study_minutes180':p.history[179]['study_minutes'],'xp180':p.history[179]['credited_xp'],
                    'daily_right_days':p.reasons['daily_right'],'weekly_right_days':p.reasons['weekly_right'],
                    'course_cap_restriction_days':p.reasons['instructor_capacity'],
                    'prebook_wait_days':p.reasons['prebook_wait'],'cap_lost180':p.history[179]['cap_lost'],
                    'validated_practice_denial_days':len({d[1]for d in filtered})if hasattr(sim,'denials')else None,
                    'denied_source_count':len({d[4]for d in filtered})if hasattr(sim,'denials')else None,
                    **{kind+'_verified_denial_days':len({d[1]for d in filtered if d[3]==kind})if hasattr(sim,'denials')else None for kind in('daily_right','weekly_right','paced_right')},
                    'max_attended_reservation_wait_days':max((w[3]for w in getattr(sim,'waits',[])if w[0]==p.key),default=None)}
                if row['both10_day']>proposal['horizon']:row['both10_day']=None
                rows.append(row)
                for field in case.targets:
                    for level in(3,5,7,10):
                        milestones.append({'variant':variant,'case':case.name,'minutes':minutes,'field':field,'level':level,
                                          **p.level_hits.get((field,level),{}),'horizon':proposal['horizon']})
                for d in proposal['report_days']:snapshots.append({'variant':variant,**p.history[d-1]})
                if case.name=='single'and variant in('B_original','B_short','Bplus_paced','Bplus','Bplus_expiring','paced_no_selfstudy'):
                    daily.extend({'variant':variant,**r}for r in p.history)
                for scenario in('sparse_existing','community_proposed'):
                    social.append({'variant':variant,'case':case.name,'minutes':minutes,**nonxp_metrics(p.history,minutes,scenario)})
                if isinstance(sim,BPlusSimulation):
                    counts=Counter(sim.sources.records[k].kind for k,v in sim.sources.claims.items()if v==p.key)
                    sources.append({'variant':variant,'case':case.name,'minutes':minutes,'catalogue_per_field':sim.case_library,
                        'completed_case_probe_horizon':counts['case'],'completed_shared_need_probe_horizon':counts['building_need'],
                        'unique_claims_cohort':len(sim.sources.claims),'registered_sources_cohort':len(sim.sources.records),
                        'probe_selfstudy_modules_started':sum(key[0]==p.key and mode=='self' for key,mode in sim.routes.items()),
                        **{'cohort_'+k+'_horizon':sim.extra[k]for k in('prebooked','attended_reservations','missed_reservations','future_reservations_cancelled','selfstudy_starts')}})
                    for kind in ('middle','expert'):
                        for field in FIELDS:
                            values=[n for(week,f,k),n in sim.teacher_starts.items()if f==field and k==kind]
                            capacities.append({'variant':variant,'case':case.name,'minutes':minutes,'field':field,'kind':kind,
                                'max_weekly_reserved':max(values,default=0),
                                'weekly_cap':sim.schedule['instructor_weekly_starts'if kind=='middle'else'expert_weekly_starts'],
                                'instructors_added':0})
    marginal=[]
    for variant in('B_original','B_short','Bplus_paced','paced_no_selfstudy'):
        for case in('single','dual'):
            for a,b in((15,30),(30,60),(60,120),(30,120)):
                low=all_sims[variant,case,a].probe;high=all_sims[variant,case,b].probe
                def finish(p):
                    hits=[p.level_hits.get((s,10),{}).get('day')for s in p.targets]
                    return max(hits)if all(hits)else None
                l,h=finish(low),finish(high)
                marginal.append({'variant':variant,'case':case,'from_minutes':a,'to_minutes':b,'low_finish_day':l,'high_finish_day':h,
                                 'calendar_days_saved':l-h if l and h else None,'extra_xp180':high.history[179]['credited_xp']-low.history[179]['credited_xp']})
    exports={'comparison':rows,'milestones':milestones,'snapshots':snapshots,'daily':daily,'community':social,
             'sources':sources,'capacity':capacities,'marginal':marginal}
    for name,data in exports.items():write_csv(out/(name+'.csv'),data)
    manifest={'notice':proposal['notice'],'base':'cfb922beacfd4f8f98925eda0524324a89c74720',
              'parameters_sha256':hashlib.sha256(json.dumps(proposal,sort_keys=True,ensure_ascii=False).encode()).hexdigest(),
              'row_counts':{k:len(v)for k,v in exports.items()},'nonxp_events':'finite explicit hypothetical community fixtures, not real activity or retention',
              'measurement':'full180 includes post-mastery days; old pre-mastery metric preserved'}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    lines=['# B+ karşılaştırması — yalnız öneri / çevrimdışı varsayım\n',
           'B XP eğrisi değişmez. Takvim B_original eski başlangıç; B_short herkes için5dk/32XP kısa başlangıç.180 sonrası kilometre taşları1460 gün ufkuna uzanır. Boş hücre=ufukta erişilemedi.\n',
           '## Mekanizmalar,30dk tek Tesisatçılık\n',table(['Varyant','L3','L5','L7','L10','Boş öğrenme: L10 öncesi','Boş öğrenme:180g tamamı','Çalışma dk@180'],
             [[r[k]for k in('variant','level3_day','level5_day','level7_day','level10_day','no_learning_pre_mastery180','no_learning_full180','study_minutes180')]for r in rows if r['case']=='single'and r['minutes']==30]),'']
    for v in('B_original','B_short','Bplus_paced','paced_no_selfstudy','Bplus','Bplus_expiring'):
        lines += [f'## {v}: tek alan süre ve boş gün\n',table(['dk','L3','L5','L7','L10','Boş L10 öncesi','Boş180g'],
            [[r[k]for k in('minutes','level3_day','level5_day','level7_day','level10_day','no_learning_pre_mastery180','no_learning_full180')]for r in rows if r['case']=='single'and r['variant']==v]),'']
    lines += ['## İki alan: B_short ve Bplus_paced\n',table(['Varyant','dk','İşletmecilik5','İki alan L10','Boş180g'],
        [[r[k]for k in('variant','minutes','business5_day','both10_day','no_learning_full180')]for r in rows if r['case']=='dual'and r['variant']in('B_short','Bplus_paced','paced_no_selfstudy')]),'',
        '## Kontenjan / kesinti / pilot / içerik riski (30dk)\n',table(['Varyant','Senaryo','L5','L7','L10','İki alan L10','Boş180g'],
         [[r[k]for k in('variant','case','level5_day','level7_day','level10_day','both10_day','no_learning_full180')]for r in rows if r['minutes']==30 and r['case']not in('single','dual','business')and r['variant']in('B_short','Bplus_paced','paced_no_selfstudy')]),'']
    (out/'TABLES.md').write_text('\n'.join(lines))


def main():
    parser=argparse.ArgumentParser(description='B+ offline research only')
    parser.add_argument('--config',type=Path,default=HERE/'bplus-config.json');parser.add_argument('--out',type=Path,default=OUT)
    parser.add_argument('--check',action='store_true');args=parser.parse_args()
    base=json.loads((HERE/'config.json').read_text());cfg=json.loads((HERE/'calendar-config.json').read_text());p=json.loads(args.config.read_text())
    if args.check:
        with tempfile.TemporaryDirectory(prefix='apartman-bplus-')as folder:
            build(base,cfg,p,Path(folder))
            for f in Path(folder).iterdir():
                if not(args.out/f.name).exists()or(args.out/f.name).read_bytes()!=f.read_bytes():raise SystemExit('MISMATCH '+f.name)
        print('PASS B+ CSV/JSON/Markdown byte reproduction')
    else:build(base,cfg,p,args.out);print('OFFLINE B+ proposals generated:',args.out)


if __name__=='__main__':main()
