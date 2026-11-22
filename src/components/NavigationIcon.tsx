import type { mainPages } from '../navigation';
type MainPage = (typeof mainPages)[number]['page'];
/** Local, decorative UI glyphs. Portraits and approved illustration files are untouched. */
export function NavigationIcon({ page }: { page: MainPage }) {
  return <svg className="navigation-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {page === 'today' && <><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-12 5 3 3 5-5"/></>}
    {page === 'home' && <><path d="m3 11 9-8 9 8M5 10v10h14V10"/><path d="M10 20v-7h4v7"/></>}
    {page === 'building' && <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1m-5 6v-3h4v3"/></>}
    {page === 'neighbors' && <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/></>}
  </svg>;
}
