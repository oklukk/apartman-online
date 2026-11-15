import { money, time } from "../api";
import type { Poll, GameEvent, Vote } from "../api";
interface Props {
  poll: Poll;
  event?: GameEvent;
  vote?: Vote;
  busy: boolean;
  onVote: (approve: boolean) => void;
}
export function PollCard({ poll, event, vote, busy, onVote }: Props) {
  const ended = new Date(poll.ends_at).getTime() <= Date.now();
  const total = poll.yes_count + poll.no_count;
  return (
    <article className="card poll">
      <div className="eyebrow">
        ORTAK KARAR{" "}
        <span className="tag">
          {poll.status === "open"
            ? ended
              ? "Sonuç hesaplanıyor"
              : "Oylama açık"
            : poll.status === "accepted"
              ? "Kabul edildi"
              : "Reddedildi"}
        </span>
      </div>
      <h2>{event?.title}</h2>
      <p>{event?.description}</p>
      <div className="poll-cost">
        <span>Ortak harcama</span>
        <strong>
          {money(event?.cost || 0)} <small>oyun parası</small>
        </strong>
      </div>
      <div className="vote-meter">
        <i
          style={{ width: `${total ? (poll.yes_count / total) * 100 : 50}%` }}
        />
      </div>
      <div className="spread subtle">
        <span>{poll.yes_count} onay</span>
        <span>{poll.no_count} ret</span>
      </div>
      {poll.status === "open" && !ended && !vote && (
        <div className="actions">
          <button disabled={busy} onClick={() => onVote(true)}>
            Onayla
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => onVote(false)}
          >
            Reddet
          </button>
        </div>
      )}
      {vote && (
        <p className="feedback">
          Oyunuz: {vote.choice ? "Onay" : "Ret"} · Bir kez oy kullanabilirsiniz.
        </p>
      )}
      <p className="footnote">
        Bitiş: {time(poll.ends_at)} · En az {poll.minimum_votes} oy, salt
        çoğunluk. Eşitlikte ret.
      </p>
    </article>
  );
}
