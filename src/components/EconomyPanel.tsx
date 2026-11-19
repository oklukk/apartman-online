import { useEffect, useState } from "react";
import { money, time } from "../api";
import { jobs, trDay, trWeek } from "../economy";
import type { EconomyData, Job, Perform } from "../economy";
export function EconomyPanel({
  data,
  busy,
  perform,
}: {
  data: EconomyData;
  busy: boolean;
  perform: Perform;
}) {
  const w = data.wallets[0],
    s = data.economy_settings[0];
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!w || !s) return <p role="status">Ekonomi bilgileri yükleniyor…</p>;
  const paid = data.wallet_transactions.find((t) => t.kind === "salary");
  const done = data.wallet_transactions.some(
    (t) => t.kind === "side_job" && t.period_key === trDay(),
  );
  const changingAllowed =
    !w.job_changed_at || Date.parse(w.job_changed_at) + 7 * 86400000 <= now;
  const taskStarted =
    !!w.side_job_started_at &&
    trDay(new Date(w.side_job_started_at)) === trDay();
  const ready = taskStarted && now - Date.parse(w.side_job_started_at!) >= 3000;
  return (
    <div className="columns economy-panels">
      <div>
        <article className="card">
          <div className="eyebrow">KİŞİSEL CÜZDAN</div>
          <div className="big-number">
            {money(w.balance)} <small>OP</small>
          </div>
          <p className="subtle">
            Bu bakiye ve kişisel hareketlerin yalnızca sana görünür.
          </p>
          <h3>Son para hareketleri</h3>
          {!data.wallet_transactions.length && (
            <p className="empty-state">Henüz para hareketin yok.</p>
          )}
          <ul className="ledger">
            {data.wallet_transactions.map((t) => (
              <li key={t.id}>
                <div>
                  {t.description}
                  <small>
                    {time(t.created_at)} · İşlem sonrası{" "}
                    {money(t.balance_after)} OP
                  </small>
                </div>
                <strong className={t.amount > 0 ? "income" : ""}>
                  {t.amount > 0 ? "+" : ""}
                  {money(t.amount)} OP
                </strong>
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <div className="eyebrow">HAFTALIK AİDAT</div>
          <h2>Borç ve ödemelerin</h2>
          <p className="footnote">
            İlk dönem: {s.first_week} · Türkiye saatiyle pazartesi. Yeni
            taşınanlara sonraki dönemden itibaren borç oluşur.
          </p>
          {!data.dues.length && (
            <p className="empty-state">Henüz aidat borcun yok.</p>
          )}
          <ul className="ledger">
            {[...data.dues]
              .sort((a, b) => b.week_start.localeCompare(a.week_start))
              .map((d) => (
                <li key={d.id}>
                  <div>
                    {d.week_start} haftası
                    <strong className="amount-inline">
                      {money(d.amount)} OP
                    </strong>
                    <small>
                      {d.paid_at
                        ? `Ödendi · ${time(d.paid_at)}`
                        : d.week_start < trWeek()
                          ? "Gecikmiş borç"
                          : "Ödenmedi"}
                    </small>
                  </div>
                  {!d.paid_at && (
                    <button
                      disabled={busy || w.balance < d.amount}
                      onClick={() =>
                        perform(
                          "pay_dues",
                          { target_due: d.id },
                          "Aidat ödendi; kişisel cüzdan ve ortak kasa birlikte güncellendi.",
                        )
                      }
                    >
                      {w.balance < d.amount ? "Bakiye yetersiz" : "Öde"}
                    </button>
                  )}
                </li>
              ))}
          </ul>
          <p className="footnote">
            Gecikme sohbet veya daire erişimini kapatmaz.
          </p>
        </article>
      </div>
      <div>
        <article className="card">
          <div className="eyebrow">İŞ HAYATI</div>
          <h2>{w.job ? jobs[w.job].title : "Henüz meslek seçmedin"}</h2>
          <p>
            Günlük maaş: <strong>{s.daily_salary} OP</strong>
          </p>
          <p className="footnote">
            İlk ödeme meslek seçiminden sonraki Türkiye gününde başlar. Son 7
            gün aktif olanlara günde bir kez ödenir; geçmiş günlerin maaşı
            birikmez.
          </p>
          <p className="subtle">
            Son maaş: {paid ? time(paid.created_at) : "Henüz ödenmedi"}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              perform(
                "player_action",
                {
                  action: "job",
                  value: String(new FormData(e.currentTarget).get("job")),
                },
                "Meslek kaydedildi.",
              );
            }}
          >
            <label>
              {w.job ? "Meslek değiştir" : "Meslek seç"}
              <select
                name="job"
                defaultValue={w.job || "office"}
                disabled={!changingAllowed || busy}
              >
                {Object.entries(jobs).map(([key, j]) => (
                  <option key={key} value={key}>
                    {j.title} · {s.daily_salary} OP/gün
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy || !changingAllowed}>Mesleği kaydet</button>
          </form>
          {!changingAllowed && (
            <p className="footnote">
              Sonraki değişiklik:{" "}
              {time(
                new Date(
                  Date.parse(w.job_changed_at!) + 7 * 86400000,
                ).toISOString(),
              )}
            </p>
          )}
        </article>
        <article className="card">
          <div className="eyebrow">GÜNLÜK EK İŞ · {s.side_job_reward} OP</div>
          <h2>{w.job ? jobs[w.job].task : "Önce bir meslek seç"}</h2>
          {w.job && (
            <>
              <p>{jobs[w.job].instruction}</p>
              {done ? (
                <p className="feedback">
                  Bugünün ek işi tamamlandı. Yarın yeniden gelebilirsin.
                </p>
              ) : taskStarted ? (
                <>
                  <p className="footnote">
                    Görevi tamamlamak için en az 3 saniye bekle.
                  </p>
                  <button
                    disabled={busy || !ready}
                    onClick={() =>
                      perform(
                        "player_action",
                        { action: "side_finish" },
                        "Ek iş tamamlandı. Gelir cüzdanına eklendi.",
                      )
                    }
                  >
                    {ready ? "Görevi tamamla" : "Hazırlanıyor…"}
                  </button>
                </>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    perform(
                      "player_action",
                      { action: "side_start" },
                      "Ek iş başladı.",
                    )
                  }
                >
                  Ek işe başla
                </button>
              )}
            </>
          )}
        </article>
      </div>
    </div>
  );
}
