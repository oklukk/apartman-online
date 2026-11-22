import { routeHref, sectionOf, sections, type Route } from '../navigation';
export function SectionNav({ route, manager = false }: { route: Route; manager?: boolean }) {
  const items = sections[route.page];
  if (!items) return null;
  return <nav className="section-nav" aria-label="Alt bölümler">{items.filter(s => s.key !== 'yonetici' || manager).map(s =>
    <a key={s.key} href={routeHref({ page: route.page, section: s.key })} aria-current={sectionOf(route) === s.key ? 'page' : undefined}>{s.label}</a>
  )}</nav>;
}
