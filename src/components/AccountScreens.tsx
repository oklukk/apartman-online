import { Avatar } from './Avatar';
import { ResidentIdentity } from './ResidentProfiles';
import type { ResidentPublicInfo } from '../social';
import { ThemeControl } from './AppShell';
import { routeHref } from '../navigation';
export function SettingsScreen({ theme, onTheme }: { theme: string; onTheme: (theme: string) => void }) {
  return <section className="card account-screen"><h1>Ayarlar</h1><ThemeControl theme={theme} onTheme={onTheme} />
    <p>Görünüm tercihin bu cihazda saklanır.</p><a className="route-link" href={routeHref({page:'security'})}>Hesap güvenliğini aç</a>
  </section>;
}
export function MyProfile({ name, userId, resident }: { name: string; userId?: string; resident?: ResidentPublicInfo }) {
  return <section className="card social-profile"><h1>Profilim</h1>
    {resident ? <ResidentIdentity resident={resident} large own/> : <><Avatar userId={userId} name={name} size={96}/><h2>{name}</h2><p>Henüz bir apartmana yerleşmedin veya daire bilgilerin yükleniyor.</p></>}
    <div className="social-links">{resident && <a className="route-link" href={routeHref({page:'home',section:'daire'})}>Daireme Git</a>}
    <a className="route-link secondary" href={routeHref({page:'settings'})}>Ayarlar</a>
    <a className="route-link secondary" href={routeHref({page:'security'})}>Hesap Güvenliği</a></div>
  </section>;
}
