"""Optional finite-learning figures; offline analysis only."""
import csv
from pathlib import Path


def render(out):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    matplotlib.rcParams.update({'font.family':'DejaVu Sans','svg.hashsalt':'apartman-finite-learning',
                               'axes.spines.top':False,'axes.spines.right':False,'font.size':10})
    def rows(name):
        with (out/name).open() as f:return list(csv.DictReader(f))
    def save(fig,name):
        fig.text(.5,.015,'ÖNERİ / ÇEVRİMDIŞI SİMÜLASYON — B XP eğrisi sabit; ileri içerik varsayımsal, canlı oyuncu verisi yok.',ha='center',fontsize=8)
        fig.savefig(out/(name+'.png'),dpi=140,bbox_inches='tight')
        p=out/(name+'.svg');fig.savefig(p,bbox_inches='tight',metadata={'Date':None})
        p.write_text('\n'.join(s.rstrip() for s in p.read_text().splitlines())+'\n')
        plt.close(fig)
    data=rows('daily.csv')
    fig,axes=plt.subplots(1,3,figsize=(12,4.5),sharey=True)
    for ax,calendar in zip(axes,'ABC'):
        for minutes,color,style in zip((15,30,60,120),('#bd6148','#315d59','#71619a','#8b6c26'),('-','--','-.',':')):
            r=[r for r in data if r['calendar']==calendar and r['case']=='single_plumbing' and int(r['minutes'])==minutes]
            ax.step([int(x['day'])for x in r],[int(x['plumbing_level'])for x in r],where='post',color=color,linestyle=style,label=f'{minutes} dk')
        ax.set(title='Takvim '+calendar,xlabel='Takvim günü',ylim=(0,10.4),yticks=range(11));ax.grid(alpha=.15)
    axes[0].set_ylabel('Tesisatçılık seviyesi');axes[0].legend(fontsize=8)
    fig.tight_layout(rect=(0,.06,1,1));save(fig,'calendar-progression')
    r=[r for r in rows('ablations.csv')if r['calendar']=='B' and r['minutes']=='30' and r['variant']!='short_windows']
    labels=['Tam takvim','Zaman kısıtı kalkarsa','Kontenjan kalkarsa','Kurs/uygulama hakları kalkarsa','Yeterlilik kalkarsa','XP tavanı kalkarsa']
    fig,axes=plt.subplots(1,2,figsize=(12,4.5))
    for ax,key,title in zip(axes,('level10_day','idle_minutes180'),('L10 için takvim günü','180 günde kullanılmayan öğrenme bütçesi (dk)')):
        values=[int(x[key])for x in r];ax.barh(labels,values,color='#315d59');ax.invert_yaxis();ax.set_title(title)
        for i,n in enumerate(values):ax.text(n+max(values)*.01,i,str(n),va='center',fontsize=9)
        ax.set_xlim(0,max(values)*1.15)
    fig.tight_layout(rect=(0,.06,1,1));save(fig,'calendar-ablation')


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[2]/'docs/game-systems-stage1/xp-balance-study/calendar')
    render(parser.parse_args().out)
