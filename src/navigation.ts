export const mainPages = [
  { page: 'today', label: 'Bugün', path: 'bugun' },
  { page: 'home', label: 'Dairem', path: 'dairem' },
  { page: 'building', label: 'Apartman', path: 'apartman' },
  { page: 'neighbors', label: 'Komşular', path: 'komsular' },
] as const;
export const accountPages = [
  { page: 'profile', label: 'Profilim', path: 'profilim' },
  { page: 'settings', label: 'Ayarlar', path: 'ayarlar' },
  { page: 'security', label: 'Hesap güvenliği', path: 'guvenlik' },
  { page: 'staff', label: 'Sistem Yönetim Merkezi', path: 'sistem' },
] as const;
export type Page = (typeof mainPages)[number]['page'] | (typeof accountPages)[number]['page'] | 'resident';
export type Route = { page: Page; section?: string; target?: string; userId?: string; from?: string };
export const sections: Partial<Record<Page, readonly { key: string; label: string }[]>> = {
  staff: [{key:'genel',label:'Genel Bakış'},{key:'oyuncular',label:'Oyuncular ve Denetim'},{key:'ekonomi',label:'Ekonomi'},{key:'secimler',label:'Seçimler ve Yönetim'},{key:'roller',label:'Roller ve Yetkiler'},{key:'gecmis',label:'İşlem Geçmişi ve Telafi'}],
  settings: [{key:'gorunum',label:'Görünüm'},{key:'gizlilik',label:'Gizlilik'}],
  home: [{ key: 'daire', label: 'Daire' }, { key: 'isler', label: 'İşler' }, { key: 'cuzdan', label: 'Cüzdan' }],
  building: [{ key: 'kesfet', label: 'Binayı Keşfet' }, { key: 'kararlar', label: 'Kararlar' }, { key: 'kasa-pano', label: 'Kasa ve Pano' }, { key: 'yonetici', label: 'Yönetici Masası' }],
  neighbors: [{ key: 'sakinler', label: 'Sakinler' }, { key: 'sohbet', label: 'Sohbet' }],
};
const pages = [...mainPages, ...accountPages, {page:'resident',label:'Komşu profili',path:'komsu'}] as const;
export const routeLabel = (route: Route) => pages.find(p => p.page === route.page)!.label;
export const sectionOf = (route: Route) => route.section || sections[route.page]?.[0].key;
export const targets = {
  dues: { page: 'home', section: 'cuzdan', target: 'aidat' },
  sideJob: { page: 'home', section: 'isler', target: 'ek-is' },
  chat: { page: 'neighbors', section: 'sohbet', target: 'message' },
  poll: (id: string): Route => ({ page: 'building', section: 'kararlar', target: 'poll-'+id }),
  election: (id: string): Route => ({ page: 'building', section: 'kararlar', target: 'election-'+id }),
} satisfies Record<string, Route | ((id: string) => Route)>;
export function routeHref(route: Route): string {
  if (route.page === 'resident') return '#/komsu/'+encodeURIComponent(route.userId || '')+(safeProfileBack(route.from) ? '?from='+encodeURIComponent(route.from!) : '');
  const path = pages.find(p => p.page === route.page)!.path;
  return '#/'+[path, route.section, route.target].filter(Boolean).map(v => encodeURIComponent(v!)).join('/');
}
export function parseRoute(hash: string): Route {
  // Auth callback fragments are owned by Supabase, never rewritten by this router.
  if (!hash.startsWith('#/')) return { page: 'today' };
  try {
    if (hash.startsWith('#/komsu/')) {
      const [id, query, extra] = hash.slice(8).split('?');
      if (extra || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return {page:'resident'};
      const from = new URLSearchParams(query).get('from') || undefined;
      return {page:'resident',userId:id,...(safeProfileBack(from) ? {from} : {})};
    }
    const [path, section, target, extra] = hash.slice(2).split('/').map(decodeURIComponent);
    const page = pages.find(p => p.path === path)?.page;
    if (!page || extra !== undefined) return { page: 'today' };
    if (section && !sections[page]?.some(s => s.key === section)) return { page };
    if (target && (!section || !/^[a-zA-Z0-9_-]{1,100}$/.test(target))) return { page, section };
    return { page, ...(section ? { section } : {}), ...(target ? { target } : {}) };
  } catch { return { page: 'today' }; }
}
export type Access = { authenticated: boolean; resident: boolean; staff: boolean };
export function routeAccess(route: Route, access: Access): 'allowed' | 'login' | 'join' | 'forbidden' {
  if (!access.authenticated) return 'login';
  if (route.page === 'staff') return access.staff ? 'allowed' : 'forbidden';
  if (accountPages.some(p => p.page === route.page)) return 'allowed';
  return access.resident ? 'allowed' : 'join';
}

export function safeProfileBack(href?: string): boolean {
  if (!href || !/^#\/(bugun|dairem|apartman|komsular|profilim|ayarlar)(\/[a-zA-Z0-9_-]+){0,2}$/.test(href)) return false;
  return routeHref(parseRoute(href)) === href;
}
