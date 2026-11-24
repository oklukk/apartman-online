import { useState } from 'react';
import { money, time } from '../api';
import { jobs, trDay } from '../economy';
import { routeHref, targets } from '../navigation';
import type { Data } from '../gameData';
import { ActivityFeed } from './ActivityFeed';
import { ManagementSummary } from './GovernancePanel';
const art = (file: string) => import.meta.env.BASE_URL + 'art/v2/' + file;
function Artwork({ file, alt, width, height, loading }: {
    file: string;
    alt: string;
    width: number;
    height: number;
    loading?: 'lazy';
}) {
    const [failed, setFailed] = useState(false);
    if (failed)
        return alt ? <div className="art-fallback" role="img" aria-label={alt}>Görsel yüklenemedi. Oyun bölümlerini kullanmaya devam edebilirsin.</div> : null;
    return <img src={art(file)} width={width} height={height} alt={alt} loading={loading} onError={() => setFailed(true)}/>;
}
export function EmptyIllustration({ kind, title, children }: {
    kind: 'chat' | 'mail' | 'vote';
    title: string;
    children?: React.ReactNode;
}) {
    return <div className="illustrated-empty">
    <Artwork file={'empty-' + kind + '.svg'} width={100} height={100} alt="" loading="lazy"/>
    <div>
    <h3>{title}</h3>{children}</div>
    </div>;
}
export function Announcements({ data }: {
    data: Data;
}) {
    return <article className="card bulletin">
    <div className="eyebrow">APARTMAN PANOSU</div>
    <h2>Duyurular</h2>
    {data.announcements.length ? data.announcements.map(a => <section key={a.id}>
        <h3>{a.title}</h3>
        <p>{a.body}</p>
        </section>) : <EmptyIllustration kind="mail" title="Pano şimdilik sakin">
        <p>Yeni duyurular burada görünecek.</p>
        </EmptyIllustration>}
  </article>;
}
export function TodayScreen({ data, userId, name }: {
    data: Data;
    userId: string;
    name: string;
}) {
    const wallet = data.wallets[0];
    const done = data.wallet_transactions.some(t => t.kind === 'side_job' && t.period_key === trDay());
    const started = !!wallet?.side_job_started_at && trDay(new Date(wallet.side_job_started_at)) === trDay();
    const salary = data.wallet_transactions.find(t => t.kind === 'salary' && trDay(new Date(t.created_at)) === trDay());
    const dues = data.dues.filter(d => !d.paid_at);
    const polls = data.polls.filter(p => p.status === 'open' && Date.parse(p.ends_at) > Date.now());
    const elections = data.elections.filter(e => ['nominations', 'voting'].includes(e.status) && Date.parse(e.voting_end) > Date.now());
    return <div className="today-screen">
    <section className="day-welcome">
    <div>
    <div className="eyebrow">BUGÜN · EVİNE HOŞ GELDİN</div>
    <h1>Merhaba, {name}.</h1>
    <p>Günün küçük işleri ve komşuların burada.</p>
    </div>
    <Artwork file="empty-chat.svg" width={150} height={150} alt=""/>
    </section>
    <dl className="day-summary" aria-label="Günlük durum">
    <div>
    <dt>Kişisel cüzdanın</dt>
    <dd>{wallet ? money(wallet.balance) + ' OP' : 'Yükleniyor…'}</dd>
    </div>
    <div>
    <dt>İş hayatın</dt>
    <dd>{wallet?.job ? jobs[wallet.job].title : 'Meslek seçilmedi'}</dd>
    </div>
    <div>
    <dt>Otomatik maaş</dt>
    <dd>{salary ? '+' + money(salary.amount) + ' OP yatırıldı' : 'Bugün maaş kaydı yok'}</dd>
    <small>{salary ? time(salary.created_at) : 'Maaş işlemlerini sistem yürütür.'}</small>
    </div>
    </dl>
    <h2 className="section-title">Günün küçük işleri</h2>
    <nav className="daily-actions" aria-label="İşlem kısayolları">
      <article className="action-story">
    <span className="eyebrow">AİDAT</span>
    <h3>{dues.length ? 'Ödenmemiş aidatın var' : 'Aidatta için rahat'}</h3>
    <p>{dues.length ? `${dues.length} dönem ödeme bekliyor. Borçlarını ve bakiyeni birlikte kontrol et.` : 'Şu anda ödenmemiş aidat borcun yok.'}</p>
    <a className="route-link" href={routeHref(targets.dues)}>{dues.length ? 'Aidat öde' : 'Ödemelerini gör'}</a>
    </article>
      <article className="action-story">
    <span className="eyebrow">GÜNLÜK EK İŞ</span>
    <h3>{done ? 'Bugünün işi tamam' : !wallet?.job ? 'Bir meslekle başla' : started ? 'İşin seni bekliyor' : 'Küçük bir işe vakit var mı?'}</h3>
    <p>{done ? 'Gelir hareketini cüzdanında görebilirsin. Yarın yeniden uğra.' : !wallet?.job ? 'Mevcut mesleklerden birini seçerek iş hayatına katıl.' : `Günlük ek iş ödülü ${data.economy_settings[0]?.side_job_reward ?? '—'} OP. Günde bir kez tamamlanabilir.`}</p>{done ? <span className="state-pill">Tamamlandı</span> : <a className="route-link" href={routeHref(targets.sideJob)}>{!wallet?.job ? 'Meslek seç' : started ? 'Ek işe devam et' : 'Ek iş'}</a>}</article>
      <article className="action-story social-story">
    <span className="eyebrow">KOMŞULUK</span>
    <h3>Bir selam iyi gelir</h3>
    <p>Komşularınla aynı sohbeti paylaş. Yeni bir mesaj bırak veya konuşmaya katıl.</p>
    <a className="route-link" href={routeHref(targets.chat)}>Sohbete katıl</a>
    </article>
      {(polls.length > 0 || elections.length > 0) && <div className="pending-stories">
        <h2>Birlikte karar veriyoruz</h2>{polls.map(p => {
                const voted = data.votes.some(v => v.poll_id === p.id);
                return <article className="decision-story" key={p.id}>
                <div>
                <h3>{data.events.find(e => e.id === p.event_id)?.title || 'Ortak karar'}</h3>
                <p>{voted ? 'Oyun kaydedildi.' : 'Oylama açık.'} Bitiş: {time(p.ends_at)}</p>
                </div>
                <a className="route-link" href={routeHref(targets.poll(p.id))}>{voted ? 'Kararı gör' : 'Ortak kararı aç'}</a>
                </article>;
            })}{elections.map(e => {
                const eligible = data.election_electorate.some(v => v.election_id === e.id && v.user_id === userId), voted = data.election_votes.some(v => v.election_id === e.id && v.user_id === userId);
                return <article className="decision-story" key={e.id}>
                <div>
                <h3>Apartman yöneticisi seçimi</h3>
                <p>{voted ? 'Oyun kaydedildi.' : !eligible ? 'Bu seçimin seçmen listesinde değilsin.' : Date.now() < Date.parse(e.nominations_end) ? 'Adaylık dönemi açık.' : 'Oy verme dönemi açık.'}</p>
                </div>
                <a className="route-link" href={routeHref(targets.election(e.id))}>{eligible && !voted ? 'Seçimi aç' : 'Seçimi incele'}</a>
                </article>;
            })}</div>}
    </nav>
    <div className="neighborhood-news">
    <ActivityFeed items={data.activity}/>
    <Announcements data={data}/>
    </div>
  </div>;
}
export function HomeScene({ name, number, building }: {
    name: string;
    number: number;
    building: string;
}) {
    return <article className="home-scene">
    <div className="home-identity">
    <div className="eyebrow">SENİN DAİREN</div>
    <h2>{name}</h2>
    <p>{building} · Daire {number}</p>
    <span className="door-plaque">{String(number).padStart(2, '0')}</span>
    <p className="subtle">İşlerin ve cüzdanın yan sekmelerde.<br />Burası günün sonunda döndüğün kapı.</p>
    </div>
    <Artwork file="apartment-interior.svg" width={900} height={600} alt="Kitaplar, çay ve sıcak ışıkla sakin bir daire içi"/>
    </article>;
}
export function BuildingScene({ data, username }: {
    data: Data;
    username: (id: string) => string;
}) {
    const building = data.buildings[0];
    return <div className="building-stage">
    <figure className="facade-scene">
    <Artwork file="apartment-facade.svg" width={1000} height={1100} alt="Dört konut katında üçer daire, ayrı giriş ve ortak bahçeli apartman"/>
    <figcaption>Pencereler ve balkonlar dekoratiftir; çevrim içi durum göstermez. Bu görünüm etkileşimli değildir.</figcaption>
    </figure>
    <div className="building-companion">
    <div className="building-intro">
    <div className="eyebrow">AYNI ÇATI ALTINDA</div>
    <h2>{building?.name}</h2>
    <p>
    <strong>{data.memberships.length} sakin</strong> · {data.apartments.length} daire</p>
    <progress aria-label="Apartman doluluğu" max={data.apartments.length || 12} value={data.memberships.length}/>
    <p>Kararlar birlikte alınır, ortak yaşam birlikte şekillenir.</p>
    <a className="route-link" href={routeHref({ page: 'building', section: 'kararlar' })}>Kararları görüntüle</a>
    <a className="route-link secondary" href={routeHref({ page: 'building', section: 'kasa-pano' })}>Kasa ve Pano</a>
    </div>
    <ManagementSummary data={data} username={username}/>
    <div className="shared-funds">
    <span>Ortak kasa</span>
    <strong>{money(building?.treasury ?? 0)} OP</strong>
    <small>Güncel tutar · Tüm sakinlere açık</small>
    </div>
    </div>
    </div>;
}
