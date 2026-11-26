export type AccountIconName = 'profile' | 'settings' | 'security' | 'staff' | 'privacy' | 'logout' | 'chevron';
/** Decorative glyphs match the existing navigation's stroke and proportions. */
export function AccountIcon({name}: {name: AccountIconName}) {
  return <svg className="account-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'profile' && <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>}
    {name === 'settings' && <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></>}
    {(name === 'security' || name === 'staff') && <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/>{name === 'security' ? <path d="m8 12 3 3 5-6"/> : <path d="M9 10h6m-6 4h6"/>}</>}
    {name === 'privacy' && <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>}
    {name === 'logout' && <><path d="M10 4H4v16h6m3-13 5 5-5 5m-5-5h12"/></>}
    {name === 'chevron' && <path d="m7 10 5 5 5-5"/>}
  </svg>;
}
