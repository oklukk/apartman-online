import { routeHref, targets, type Route } from '../navigation';
import { trDay } from '../economy';
import type { EconomyData } from '../economy';
import type { Poll, Vote } from '../api';
export function TodayActions({ data, userId }: { data: EconomyData & { polls: Poll[]; votes: Vote[] }; userId: string }) {
  const links: { label: string; route: Route }[] = [];
  if (data.dues.some(d => !d.paid_at)) links.push({label:'Aidat öde',route:targets.dues});
  if (data.wallets[0]?.job && !data.wallet_transactions.some(t => t.kind === 'side_job' && t.period_key === trDay())) links.push({label:'Ek iş',route:targets.sideJob});
  for (const p of data.polls.filter(p => p.status === 'open' && Date.parse(p.ends_at) > Date.now() && !data.votes.some(v => v.poll_id === p.id))) links.push({label:'Ortak kararı aç',route:targets.poll(p.id)});
  for (const e of data.elections.filter(e => ['nominations','voting'].includes(e.status) && Date.parse(e.voting_end) > Date.now() && data.election_electorate.some(v => v.election_id === e.id && v.user_id === userId))) links.push({label:'Seçimi aç',route:targets.election(e.id)});
  links.push({label:'Sohbete katıl',route:targets.chat});
  return <nav className="today-links" aria-label="İşlem kısayolları">{links.map(l => <a className="route-link" key={routeHref(l.route)} href={routeHref(l.route)}>{l.label}</a>)}</nav>;
}
