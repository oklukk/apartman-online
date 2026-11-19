import { time } from "../api";
import type { Activity } from "../api";
export function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <article className="card">
      <div className="eyebrow">APARTMAN GÜNLÜĞÜ</div>
      <h2>Son gelişmeler</h2>
      {items.length ? (
        <ol className="timeline">
          {items.map((a) => (
            <li key={a.id}>
              <p>{a.description}</p>
              <time dateTime={a.created_at}>{time(a.created_at)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-state">
          İlk gelişme komşular taşındığında burada görünecek.
        </p>
      )}
    </article>
  );
}
