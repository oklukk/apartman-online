import { AccountLayout } from './AccountLayout';
import { AccountIcon } from './AccountIcon';
import { appearanceDefaults, type Appearance } from '../appearance';
import { Avatar } from './Avatar';
import { ResidentIdentity } from './ResidentProfiles';
import type { ResidentPublicInfo } from '../social';
import { ThemeControl } from './AppShell';
import { routeHref } from '../navigation';
export type BlockedNeighbor = {userId:string;resident?:ResidentPublicInfo};
export function SettingsScreen({ theme, onTheme, appearance, onAppearance, canPersist, view, blocked, resident, loading, busy, onUnblock }: {
  theme:string;onTheme:(theme:string)=>void;appearance:Appearance;onAppearance:(value:Appearance)=>void;canPersist:boolean;
  view:'gorunum'|'gizlilik';blocked:BlockedNeighbor[];resident:boolean;loading:boolean;busy:boolean;onUnblock:(id:string)=>void;
}) {
  return <AccountLayout view={view} title="Ayarlar" intro="Oyunu kendine göre rahatlat; hesap ve paylaşım sınırlarını buradan takip et.">
    {view === 'gorunum' ? <div className="settings-columns">
      <section className="card appearance-card"><div className="settings-title"><AccountIcon name="settings"/><h2>Görünümün</h2></div>
        <p className="subtle">Görünüm tercihin bu cihazda saklanır.</p>
        <fieldset><legend>Renk ve okunabilirlik</legend><ThemeControl theme={theme} onTheme={onTheme}/>
          <label>Yazı boyutu<select value={appearance.textSize} onChange={e=>onAppearance({...appearance,textSize:e.target.value==='large'?'large':'normal'})}><option value="normal">Normal</option><option value="large">Büyük</option></select><small>Metinleri büyütür; tarayıcı yakınlaştırmasını değiştirmez.</small></label>
          <label>Ekran yoğunluğu<select value={appearance.density} onChange={e=>onAppearance({...appearance,density:e.target.value==='compact'?'compact':'standard'})}><option value="standard">Standart</option><option value="compact">Kompakt</option></select><small>Kart ve liste boşluklarını azaltır. İşlemler ve dokunma alanları korunur.</small></label>
        </fieldset>
        <fieldset><legend>Hareket</legend><label className="check-setting"><input type="checkbox" checked={appearance.reduceMotion} onChange={e=>onAppearance({...appearance,reduceMotion:e.target.checked})}/><span>Hareketi azalt</span></label><p className="footnote">Geçişleri ve hareketleri azaltır. Cihazının hareket azaltma tercihi her zaman korunur.</p></fieldset>
        <p className={'device-save'+(!canPersist?' storage-warning':'')} role="status">{canPersist ? 'Tercihler bu tarayıcıda saklanıyor; başka cihazlara taşınmaz.' : 'Tarayıcı saklamaya izin vermiyor. Tercihler bu oturumda uygulanıyor; yenilemede korunmayabilir.'}</p>
        <button className="secondary" type="button" onClick={()=>{onTheme('system');onAppearance({...appearanceDefaults});}}>Görünüm tercihlerini sıfırla</button>
      </section>
      <aside className="settings-aside"><article className="card settings-note"><span className="eyebrow">KENDİ HIZINDA</span><h2>Küçük bir değişiklik, daha rahat bir oyun</h2><p>Yazıları, boşlukları ve renkleri birlikte deneyebilirsin. Seçimlerin oyun kurallarını veya karakterinin avatarını değiştirmez.</p><a className="route-link" href={routeHref({page:'profile'})}>Profilime git</a></article>
        <article className="settings-note"><h2>Gelişmeleri takip et</h2><p>Mevcut apartman gelişmeleri ve duyurular Bugün ekranı ile apartman panosunda yer alır. Kişisel bir bildirim merkezi henüz bulunmuyor.</p>{resident && <a className="profile-back" href={routeHref({page:'building',section:'kasa-pano'})}>Kasa ve Pano'yu aç →</a>}</article>
      </aside>
    </div> : <div className="settings-columns">
      <section className="card privacy-card"><div className="settings-title"><AccountIcon name="privacy"/><h2>Mesajlarını gizlediğin komşular</h2></div><p className="subtle">Gizleme yalnız senin sohbet görünümünü etkiler; karşılıklı profil erişimini engellemez.</p>
        {loading ? <p role="status">Komşu bilgileri yükleniyor…</p> : blocked.length ? <ul className="blocked-neighbors">{blocked.map(item=><li key={item.userId}><Avatar userId={item.resident?.userId} name={item.resident?.username || 'Komşu'} size={44}/><div><strong>{item.resident?.username || 'Bilgisine erişilemeyen komşu'}</strong>{item.resident && <><small>Daire {String(item.resident.apartmentNumber).padStart(2,'0')}</small><a className="profile-back" href={routeHref({page:'resident',userId:item.userId,from:routeHref({page:'settings',section:'gizlilik'})})}>Profili gör</a></>}</div><button type="button" className="secondary" disabled={busy} onClick={()=>onUnblock(item.userId)}>Engeli kaldır</button></li>)}</ul> : <div className="privacy-empty"><h3>Gizlenmiş mesaj yok</h3><p>{resident ? 'Şu anda mesajlarını gizlediğin bir komşu yok. Bu işlemi komşu kartlarından kullanabilirsin.' : 'Apartmana katıldıktan sonra komşu kartlarından mesajları gizleyebilirsin.'}</p>{resident && <a className="route-link" href={routeHref({page:'neighbors',section:'sakinler'})}>Sakinlere git</a>}</div>}
      </section>
      <aside className="card settings-note"><h2>Sosyal profilinde ne görünür?</h2><p>Aynı apartmandaki komşuların kullanıcı adını, avatarını, daire ve katını, katılım ayını ve varsa görevdeki apartman yöneticisi rozetini görebilir.</p><p>Kişisel cüzdanın, bireysel borçların ve hesap güvenliği bilgilerin sosyal profilinde paylaşılmaz.</p><a className="route-link" href={routeHref({page:'profile'})}>Profilimi incele</a></aside>
    </div>}
  </AccountLayout>;
}
export function MyProfile({ name, userId, resident }: { name: string; userId?: string; resident?: ResidentPublicInfo }) {
  return <section className="card social-profile"><h1>Profilim</h1>
    {resident ? <ResidentIdentity resident={resident} large own/> : <><Avatar userId={userId} name={name} size={96}/><h2>{name}</h2><p>Henüz bir apartmana yerleşmedin veya daire bilgilerin yükleniyor.</p></>}
    <div className="social-links">{resident && <a className="route-link" href={routeHref({page:'home',section:'daire'})}>Daireme Git</a>}
    <a className="route-link secondary" href={routeHref({page:'settings'})}>Ayarlar</a>
    <a className="route-link secondary" href={routeHref({page:'security'})}>Hesap Güvenliği</a></div>
  </section>;
}
