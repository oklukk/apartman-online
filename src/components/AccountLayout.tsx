import type {ReactNode} from 'react';
import {routeHref} from '../navigation';
import {AccountIcon} from './AccountIcon';
export function AccountLayout({view,title,intro,children}: {view:'gorunum'|'gizlilik'|'security';title:string;intro:string;children:ReactNode}) {
  return <section className="account-hub">
    <header className="account-heading"><div className="eyebrow">SANA AİT ALAN</div><h1>{title}</h1><p>{intro}</p></header>
    <nav className="account-sections" aria-label="Ayar bölümleri">
      <a href={routeHref({page:'settings',section:'gorunum'})} aria-current={view==='gorunum'?'page':undefined}><AccountIcon name="settings"/>Görünüm</a>
      <a href={routeHref({page:'settings',section:'gizlilik'})} aria-current={view==='gizlilik'?'page':undefined}><AccountIcon name="privacy"/>Gizlilik</a>
      <a aria-label="Hesap güvenliği" href={routeHref({page:'security'})} aria-current={view==='security'?'page':undefined}><AccountIcon name="security"/>Güvenlik</a>
    </nav>
    {children}
  </section>;
}
