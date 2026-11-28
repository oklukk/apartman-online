"""Optional standard plots for B+; no game screenshots or production imports."""
import csv
from pathlib import Path


def render(out):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams.update({'font.family':'DejaVu Sans','svg.hashsalt':'apartman-bplus-study',
                         'axes.spines.top':False,'axes.spines.right':False,'font.size':10})
    def rows(name):
        with (out/name).open() as f:return list(csv.DictReader(f))
    def save(fig,name):
        fig.text(.5,.015,'ÖNERİ / ÇEVRİMDIŞI: ileri yol ve olgu arzı varsayımsal; gerçek oyuncu verisi veya tutma ölçümü değildir.',ha='center',fontsize=8)
        fig.savefig(out/(name+'.png'),dpi=140,bbox_inches='tight')
        p=out/(name+'.svg');fig.savefig(p,bbox_inches='tight',metadata={'Date':None})
        p.write_text('\n'.join(s.rstrip() for s in p.read_text().splitlines())+'\n')
        plt.close(fig)
    data=rows('comparison.csv');daily=rows('daily.csv')
    fig,axes=plt.subplots(1,2,figsize=(13,5))
    variants=['B_original','B_short','Bplus_expiring','Bplus','Bplus_paced','paced_no_selfstudy']
    labels=['B ilk referans','B kısa başlangıç','B+ erken eskiyen kaynak','B+ toplu hak tüketimi','B+D yayılan hak + bireysel alternatif','B+S yayılan hak, ders yolu']
    selected=[next(r for r in data if r['variant']==v and r['case']=='single'and r['minutes']=='30')for v in variants]
    pre=[int(r['no_learning_pre_mastery180'])for r in selected]
    post=[int(r['after_mastery_no_learning180'])for r in selected]
    axes[0].barh(labels,pre,color='#315d59',label='L10 öncesi')
    axes[0].barh(labels,post,left=pre,color='#d9ac65',label='L10 tamamlandıktan sonra')
    for i,(a,b)in enumerate(zip(pre,post)):axes[0].text(a+b+1,i,str(a+b),va='center')
    axes[0].invert_yaxis();axes[0].set(title='30dk tek alan: 180 günde öğrenme olmayan gün',xlim=(0,85));axes[0].legend(fontsize=8)
    for variant,minutes,color,style in [('B_original',30,'#bd6148','-'),('paced_no_selfstudy',15,'#7260a1','--'),
                                        ('paced_no_selfstudy',30,'#315d59','-'),('paced_no_selfstudy',120,'#8b6c26',':')]:
        rs=[r for r in daily if r['variant']==variant and r['minutes']==str(minutes)]
        axes[1].step([int(r['day'])for r in rs],[int(r['plumbing_level'])for r in rs],where='post',color=color,linestyle=style,label=f'{"B" if variant=="B_original"else"B+S"} {minutes}dk')
    axes[1].set(title='Aynı B XP eğrisinde tek alan',xlabel='Takvim günü',ylabel='Tesisatçılık seviyesi',yticks=range(11),ylim=(0,10.4));axes[1].legend(fontsize=8);axes[1].grid(alpha=.15)
    fig.tight_layout(rect=(0,.06,1,1));save(fig,'bplus-learning')

    fig,axes=plt.subplots(1,2,figsize=(12,4.5))
    for case,ax in zip(('single','dual'),axes):
        for v,color in [('B_short','#bd6148'),('Bplus_paced','#7260a1'),('paced_no_selfstudy','#315d59')]:
            rs=[r for r in data if r['variant']==v and r['case']==case]
            ax.plot([int(r['minutes'])for r in rs],[int(r['both10_day'])for r in rs],'o-',color=color,label=v)
        ax.set(title='Tek yetenek L10'if case=='single'else'İki yeteneğin ikisi de L10',xlabel='Günlük öğrenme bütçesi (dk)',ylabel='Takvim günü',xticks=[15,30,60,120]);ax.legend();ax.grid(alpha=.15)
    fig.tight_layout(rect=(0,.06,1,1));save(fig,'bplus-marginal')


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[2]/'docs/game-systems-stage1/xp-balance-study/bplus')
    render(parser.parse_args().out)
