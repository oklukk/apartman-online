import { ThemeControl } from './AppShell';
import { routeHref } from '../navigation';
export function SettingsScreen({ theme, onTheme }: { theme: string; onTheme: (theme: string) => void }) {
  return <section className="card account-screen"><h1>Ayarlar</h1><ThemeControl theme={theme} onTheme={onTheme} />
    <p>Görünüm tercihin bu cihazda saklanır.</p><a className="route-link" href={routeHref({page:'security'})}>Hesap güvenliğini aç</a>
  </section>;
}
export function MyProfile({ name, apartment, building }: { name: string; apartment?: number; building?: string }) {
  return <section className="card"><h1>Profilim</h1><h2>{name}</h2><p>{apartment ? `${building} · Daire ${apartment}` : 'Henüz bir apartmana yerleşmedin.'}</p>
    {apartment && <a className="route-link" href={routeHref({ page:'home' })}>Daireme git</a>}
    <p><a className="route-link" href={routeHref({page:'settings'})}>Ayarlar</a></p>
  </section>;
}
