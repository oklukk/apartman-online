import { useEffect, useRef, type RefObject } from 'react';
import type { ResidentPublicInfo } from '../social';
import { routeHref, targets, type Route } from '../navigation';
import { Avatar } from './Avatar';
export function ResidentIdentity({ resident, large = false, own = false }: { resident: ResidentPublicInfo; large?: boolean; own?: boolean }) {
  return <div className="resident-identity">
    <Avatar userId={resident.userId} name={resident.username} size={large ? 112 : 72} />
    <div><h2>{resident.username}</h2><p>{resident.buildingName}</p><p>Daire {String(resident.apartmentNumber).padStart(2,'0')} · {resident.floor}. kat</p>
      {resident.joinedMonth && <p className="subtle">{resident.joinedMonth} tarihinden beri komşumuz</p>}
      <div className="resident-badges">{own && <span className="state-pill">Senin dairen</span>}{resident.isManager && <span className="state-pill manager-badge">Apartman yöneticisi</span>}</div>
    </div>
  </div>;
}
function SocialLinks({ resident, own, blocked, busy, onBlock, onNavigate }: {
  resident: ResidentPublicInfo; own: boolean; blocked: boolean; busy: boolean; onBlock: () => void; onNavigate?: (destination?: Route) => void;
}) {
  return <div className="social-links">
    <a className="route-link" href={routeHref(own ? {page:'home',section:'daire'} : {page:'building',section:'kesfet',target:'daire-'+String(resident.apartmentNumber).padStart(2,'0')})} onClick={() => onNavigate?.(own ? {page:'home',section:'daire'} : {page:'building',section:'kesfet',target:'daire-'+String(resident.apartmentNumber).padStart(2,'0')})}>{own ? 'Daireme Git' : 'Daireyi Gör'}</a>
    <a className="route-link secondary" href={routeHref(targets.chat)} onClick={() => onNavigate?.(targets.chat)}>Sohbete Git</a>
    {!own && <><button type="button" className="secondary" disabled={busy} onClick={onBlock}>{blocked ? 'Engeli kaldır' : 'Mesajları gizle'}</button><p className="footnote">{blocked ? 'Bu komşunun mesajları senin sohbet görünümünde gizli.' : 'Mesajları gizlemek yalnız senin sohbet görünümünü etkiler.'} Profil erişimi değişmez.</p></>}
  </div>;
}
export function ResidentQuickProfile({ resident, own, blocked, busy, origin, opener, onClose, onNavigate, onBlock }: {
  resident?: ResidentPublicInfo; own: boolean; blocked: boolean; busy: boolean; origin: Route;
  opener: RefObject<HTMLElement | null>; onClose: () => void; onNavigate: (destination?: Route) => void; onBlock: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = opener.current;
    const scroll = {x:window.scrollX,y:window.scrollY};
    element?.showModal();
    element?.querySelector<HTMLButtonElement>('.profile-close')?.focus({preventScroll:true});
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close(); document.body.style.overflow = previous;
      if (trigger?.isConnected) trigger.focus({preventScroll:true});
      else document.querySelector<HTMLElement>('main h1')?.focus({preventScroll:true});
      window.scrollTo(scroll.x,scroll.y);
    };
  }, [opener]);
  return <dialog className="resident-sheet art-v2" ref={dialog} aria-labelledby="resident-sheet-title" onKeyDown={e => {
    if (e.key !== 'Tab') return;
    const stops = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(node => node.getClientRects().length > 0);
    if (!stops.length) return;
    e.preventDefault();
    const index = stops.indexOf(document.activeElement as HTMLElement);
    const next = index < 0 ? (e.shiftKey ? stops.length - 1 : 0) : (index + (e.shiftKey ? stops.length - 1 : 1)) % stops.length;
    stops[next].focus();
  }} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => {
    const bounds = e.currentTarget.getBoundingClientRect();
    if (e.target === e.currentTarget && (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom)) onClose();
  }}>
    <div className="sheet-heading"><h2 id="resident-sheet-title">Komşu kartı</h2><button type="button" className="secondary profile-close" onClick={onClose} aria-label="Profili kapat">×</button></div>
    {resident ? <><ResidentIdentity resident={resident} own={own}/>
      <a className="route-link full-profile-link" href={routeHref({page:'resident',userId:resident.userId,from:routeHref(origin)})} onClick={() => onNavigate()}>Tam Profili Gör</a>
      <SocialLinks resident={resident} own={own} blocked={blocked} busy={busy} onBlock={onBlock} onNavigate={onNavigate}/>
    </> : <p role="status">Bu komşunun profiline şu anda erişilemiyor.</p>}
  </dialog>;
}
export function ResidentFullProfile({ resident, own, blocked, busy, back, onBlock }: {
  resident?: ResidentPublicInfo; own: boolean; blocked: boolean; busy: boolean; back: string; onBlock: () => void;
}) {
  return <section className="card social-profile"><a className="profile-back" href={back}>← Önceki bölüme dön</a>
    <h1>{own ? 'Senin sosyal profilin' : 'Komşu profili'}</h1>
    {resident ? <><ResidentIdentity resident={resident} large own={own}/><SocialLinks resident={resident} own={own} blocked={blocked} busy={busy} onBlock={onBlock}/></> : <p role="status">Bu profile erişilemiyor. Kullanıcı artık apartmanında olmayabilir.</p>}
  </section>;
}
