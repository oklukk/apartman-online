import { useEffect, useRef, type ReactNode } from 'react';
import { AccountIcon } from './AccountIcon';
import { Avatar } from './Avatar';
import { NavigationIcon } from './NavigationIcon';
import { accountPages, mainPages, routeHref, routeLabel, type Route, type Access } from '../navigation';
export function ThemeControl({ theme, onTheme }: { theme: string; onTheme: (theme: string) => void }) {
  return <label>Görünüm<select aria-label="Tema" value={theme} onChange={e => onTheme(e.target.value)}>
    <option value="system">Sistem</option><option value="light">Açık</option><option value="dark">Koyu</option>
  </select></label>;
}
export function AppShell({ route, access, name, userId, building, live, busy, theme, onTheme, onSignOut, children }: {
  route: Route; access: Access; name: string; userId?: string; building: string; live: string; busy: boolean;
  theme: string; onTheme: (theme: string) => void; onSignOut: () => void; children: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = (restoreFocus = false) => {
    const element = menu.current;
    if (!element) return;
    element.open = false;
    if (restoreFocus) element.querySelector('summary')?.focus({preventScroll:true});
  };
  useEffect(() => {
    if (!menu.current?.open) return;
    close(menu.current.contains(document.activeElement));
  }, [route]);
  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      const element = menu.current;
      if (!element?.open || !(event.target instanceof Node) || element.contains(event.target)) return;
      const restore = element.contains(document.activeElement);
      element.open = false;
      // Keep focus visible for a non-focusable outside target. The pointer's default
      // action still focuses a clicked link/input/button; never prevent that action.
      if (restore) element.querySelector('summary')?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    return () => document.removeEventListener('pointerdown', dismissOutside, true);
  }, []);
  return <div className={'shell art-v2 navigation-v2'+((access.resident && mainPages.some(p=>p.page===route.page)) || (access.authenticated && ['profile','settings','security'].includes(route.page)) || (route.page==='staff' && access.staff) ? ' player-shell' : '')+(route.page==='staff' && access.staff?' staff-shell':'')}>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>İçeriğe geç</a>
    <aside className="sidebar">
      <a href={routeHref({ page: 'today' })} className="brand"><img src={import.meta.env.BASE_URL+'art/v2/logo-mark.svg'} width="40" height="44" alt="" /><span>APARTMAN<small>Birlikte yaşanan bir dünya.</small></span></a>
      <div className="building-label">{route.page==='staff' && access.staff?'Personel çalışma alanı':building}</div>
      {access.resident && !(route.page==='staff' && access.staff) && <nav className="primary-nav" aria-label="Ana bölümler">
        {mainPages.map(p => <a key={p.page} href={routeHref({ page: p.page })} aria-current={route.page === p.page ? 'page' : undefined}><NavigationIcon page={p.page} /><span>{p.label}</span></a>)}
      </nav>}
      {route.page==='staff' && access.staff && <a className="route-link staff-world-return" href={routeHref({page:'today'})}>← Oyuna dön</a>}
      <div className="sidebar-bottom">{route.page==='staff' && access.staff?'Sunucu denetimli işlemler':live}<small>{route.page==='staff' && access.staff?'Her işlem yetki ve kapsam kontrolünden geçer.':'Gelişmeler düzenli olarak yenilenir.'}</small></div>
    </aside>
    <main id="main-content" tabIndex={-1}>
      <header className="topbar"><span>{route.page==='staff' && access.staff?'APARTMAN':building}<span className="subtle"> / {access.authenticated ? routeLabel(route) : 'Hoş geldiniz'}</span></span>
        {access.authenticated ? <details className="account-menu" ref={menu} onKeyDown={e => {
          if (e.key === 'Escape') { close(); menu.current?.querySelector('summary')?.focus(); }
        }}><summary><Avatar userId={userId} name={name} size={36}/><span className="account-name">{name}</span><AccountIcon name="chevron"/></summary>
          <nav aria-label="Hesap menüsü">{accountPages.filter(p => p.page !== 'staff' || access.staff).map(p => <a key={p.page} href={routeHref({ page:p.page })} onClick={() => close(true)} aria-current={route.page === p.page ? 'page' : undefined}><AccountIcon name={p.page}/><span>{p.label}</span></a>)}
            <button type="button" className="secondary" disabled={busy} onClick={() => { close(true); onSignOut(); }}><AccountIcon name="logout"/>Çıkış yap</button>
          </nav>
        </details> : <ThemeControl theme={theme} onTheme={onTheme} />}
      </header>
      {children}
      <footer>APARTMAN <span>Gerçek komşular, ortak bir hikâye.</span></footer>
    </main>
  </div>;
}
