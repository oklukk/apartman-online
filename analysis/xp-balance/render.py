"""Optional offline scientific plots; matplotlib is analysis tooling, not an app dependency."""
import csv
from pathlib import Path


def render(out: Path) -> None:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    matplotlib.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10,
                               'svg.hashsalt': 'apartman-a2-2-proposals', 'axes.spines.top': False,
                               'axes.spines.right': False})
    def rows(name):
        with (out / name).open(encoding='utf-8') as f:
            return list(csv.DictReader(f))
    def save(fig, name):
        fig.text(.5, .015, 'ÖNERİ / ÇEVRİMDIŞI SİMÜLASYON — mevcut oyun kuralı veya canlı oyuncu sonucu değildir.',
                 ha='center', fontsize=8)
        fig.savefig(out / (name + '.png'), dpi=140, bbox_inches='tight', metadata={'Software': 'APARTMAN offline XP study'})
        fig.savefig(out / (name + '.svg'), bbox_inches='tight', metadata={'Date': None, 'Creator': 'APARTMAN offline XP study'})
        svg_path = out / (name + '.svg')
        svg_path.write_text('\n'.join(line.rstrip() for line in svg_path.read_text().splitlines()) + '\n', encoding='utf-8')
        plt.close(fig)
    colors = {'A': '#bb593b', 'B': '#315d59', 'C': '#7260a1'}
    curves = rows('curves.csv')
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    for model in colors:
        data = [r for r in curves if r['model'] == model]
        for ax, key in zip(axes, ('total_xp', 'normalized_total_xp')):
            ax.plot([int(r['level']) for r in data], [int(r[key]) for r in data], 'o-', color=colors[model], label=model)
    for ax, title in zip(axes, ('Paketlerin önerilen toplam XP maliyeti', 'Eşit toplam 3600 XP: yalnız eğri biçimi')):
        ax.set(title=title, xlabel='Seviye', ylabel='Birikimli XP', xticks=range(11))
        ax.grid(alpha=.15); ax.legend(title='Model')
    fig.tight_layout(rect=(0, .055, 1, 1)); save(fig, 'curves')

    daily = rows('daily.csv')
    fig, axes = plt.subplots(2, 3, figsize=(13, 7), sharex=True, sharey=True)
    palette = ['#bb593b', '#315d59', '#7260a1', '#586b28', '#526c92']
    for col, model in enumerate(colors):
        for row, scenario in enumerate(('single_plumbing', 'dual')):
            ax = axes[row, col]
            for color, minutes in zip(palette, (15, 30, 60, 120, 180)):
                data = [r for r in daily if r['model'] == model and r['scenario'] == scenario and int(r['minutes_per_active_day']) == minutes]
                ax.step([int(r['day']) for r in data], [int(r['plumbing_level']) for r in data], where='post', color=color, label=f'{minutes} dk', alpha=.85)
            ax.set(title=f'{model} — ' + ('tek yetenek' if row == 0 else 'iki yetenek / Tesisatçılık'), ylim=(0, 10.3), yticks=range(0, 11, 2))
            ax.grid(alpha=.15)
            if col == 0: ax.set_ylabel('Tesisatçılık seviyesi')
            if row: ax.set_xlabel('Takvim günü')
    axes[0, 0].legend(fontsize=8, ncol=2)
    fig.suptitle('Aynı sıfır başlangıcı; eğitim erişimi varsayımı, canlı veri yok')
    fig.tight_layout(rect=(0, .05, 1, .96)); save(fig, 'progression')

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    for color, scenario, label in zip(palette, ('dual', 'irregular', 'break14', 'return_bonus', 'newcomer30'),
              ('Düzenli', 'Haftada 3 gün', '14 gün ara', 'Ara + öneri bonusu', '31. gün başlayan')):
        data = [r for r in daily if r['model'] == 'B' and r['scenario'] == scenario and int(r['minutes_per_active_day']) == 30]
        axes[0].step([int(r['day']) for r in data], [int(r['plumbing_level']) for r in data], where='post', color=color, label=label)
        axes[1].plot([int(r['day']) for r in data], [int(r['credited_xp']) for r in data], color=color, label=label)
    axes[0].set(title='Model B: 30 dk, iki yetenek', ylabel='Tesisatçılık seviyesi', ylim=(0, 10.3))
    axes[1].set(title='Toplam kazanılan XP (iki yetenek)', ylabel='XP')
    for ax in axes: ax.set_xlabel('Takvim günü'); ax.grid(alpha=.15)
    axes[0].legend(fontsize=8)
    fig.tight_layout(rect=(0, .055, 1, 1)); save(fig, 'attendance')
