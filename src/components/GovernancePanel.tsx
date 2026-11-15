import { money, time } from "../api";
import { currentTerm, trWeek } from "../economy";
import type { EconomyData, Perform } from "../economy";
interface Props {
  data: EconomyData;
  userId: string;
  username: (id: string) => string;
  busy: boolean;
  perform: Perform;
}
export function ManagementSummary({
  data,
  username,
}: {
  data: EconomyData;
  username: (id: string) => string;
}) {
  const manager = currentTerm(data.manager_terms),
    week = trWeek();
  const movements = data.treasury_history.filter(
    (t) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(t.created_at)) >= week,
  );
  const income = movements
      .filter((t) => t.amount > 0)
      .reduce((a, t) => a + t.amount, 0),
    expense = movements
      .filter((t) => t.amount < 0)
      .reduce((a, t) => a - t.amount, 0);
  return (
    <article className="card">
      <div className="eyebrow">ORTAK YAŞAM · BU HAFTA</div>
      <h2>
        Yönetici: {manager ? username(manager.user_id) : "Görevde yönetici yok"}
      </h2>
      {manager && (
        <p className="footnote">Görev bitişi: {time(manager.ends_at)}</p>
      )}
      <div className="spread">
        <p>
          Gelir <strong>+{money(income)} OP</strong>
        </p>
        <p>
          Gider <strong>−{money(expense)} OP</strong>
        </p>
      </div>
      <p className="footnote">
        Maaş, aidat, işletme giderleri ve seçim takvimi yönetici çevrimdışıyken
        de çalışır.
      </p>
    </article>
  );
}
export function GovernancePanel({
  data,
  userId,
  username,
  busy,
  perform,
}: Props) {
  const term = currentTerm(data.manager_terms),
    isManager = term?.user_id === userId;
  const s = data.economy_settings[0];
  const active = data.elections.find(
    (e) => e.status === "nominations" || e.status === "voting",
  );
  const latest = [...data.elections].sort((a, b) =>
    b.starts_at.localeCompare(a.starts_at),
  )[0];
  const ownVote = data.election_votes.find(
    (v) => v.election_id === active?.id && v.user_id === userId,
  );
  const eligible = data.election_electorate.some(
    (v) => v.election_id === active?.id && v.user_id === userId,
  );
  const nominations = active && Date.now() < Date.parse(active.nominations_end);
  const voting =
    active &&
    Date.now() >= Date.parse(active.nominations_end) &&
    Date.now() < Date.parse(active.voting_end);
  const candidate = data.election_candidates.some(
    (c) => c.election_id === active?.id && c.user_id === userId,
  );
  return (
    <>
      <ManagementSummary data={data} username={username} />
      <div className="columns">
        <div>
          <article className="card">
            <div className="eyebrow">YÖNETİCİ SEÇİMİ</div>
            <h2>
              {active
                ? nominations
                  ? "Adaylık açık"
                  : voting
                    ? "Oy verme açık"
                    : "Sonuç hesaplanıyor"
                : "Seçim takvimi"}
            </h2>
            <p className="footnote">
              24 saat adaylık + 48 saat oy verme. Sabit seçmen listesinin en az
              yarısı (yukarı yuvarlanır) ve en az 2 oy gerekir. Tek oyuncuyla
              seçim açılmaz. En çok oyu alan tek aday kazanır. Eşitlik, aday
              çıkmaması veya yetersiz katılımda 24 saat sonra yeniden adaylık
              açılır.
            </p>
            {active ? (
              <>
                <p>
                  {active.electorate_size} seçmen · Gerekli oy: {active.quorum}
                </p>
                <p className="footnote">
                  Adaylık bitişi: {time(active.nominations_end)}
                  <br />
                  Oy verme bitişi: {time(active.voting_end)}
                </p>
                {!eligible && (
                  <p className="feedback">
                    Bu seçimin seçmen listesinde değilsin. Sonraki seçimde
                    katılabilirsin.
                  </p>
                )}
                {nominations && eligible && !candidate && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      perform(
                        "election_action",
                        {
                          target_election: active.id,
                          action: "candidate",
                          value: String(
                            new FormData(e.currentTarget).get("statement"),
                          ),
                        },
                        "Yönetici adaylığın kaydedildi.",
                      );
                    }}
                  >
                    <label>
                      Seçim vaadin
                      <textarea
                        name="statement"
                        required
                        minLength={3}
                        maxLength={300}
                        rows={3}
                      />
                    </label>
                    <button disabled={busy}>Aday ol</button>
                  </form>
                )}
                <ul className="candidate-list">
                  {data.election_candidates
                    .filter((c) => c.election_id === active.id)
                    .map((c) => (
                      <li key={c.user_id}>
                        <div className="spread">
                          <h3>{username(c.user_id)}</h3>
                          <span className="tag">
                            {
                              data.election_votes.filter(
                                (v) =>
                                  v.election_id === active.id &&
                                  v.candidate_id === c.user_id,
                              ).length
                            }{" "}
                            oy
                          </span>
                        </div>
                        <p>{c.statement}</p>
                        {voting && eligible && !ownVote && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              perform(
                                "election_action",
                                {
                                  target_election: active.id,
                                  action: "vote",
                                  value: c.user_id,
                                },
                                "Seçim oyun kaydedildi.",
                              )
                            }
                          >
                            Bu adaya oy ver
                          </button>
                        )}
                        {ownVote?.candidate_id === c.user_id && (
                          <p className="feedback">Oyun bu adaya kaydedildi.</p>
                        )}
                      </li>
                    ))}
                </ul>
                {!data.election_candidates.some(
                  (c) => c.election_id === active.id,
                ) && <p className="subtle">Henüz aday yok.</p>}
              </>
            ) : (
              <>
                <p>
                  {term
                    ? `Yeni adaylık mevcut görev bitiminden 72 saat önce açılır. Görev bitişi: ${time(term.ends_at)}`
                    : "En az iki sakin varsa yeni seçim otomatik açılır."}
                </p>
                {latest?.status === "failed" && (
                  <p className="feedback">
                    {latest.result_reason}. Yeniden adaylık:{" "}
                    {latest.retry_after
                      ? time(latest.retry_after)
                      : "Planlanıyor"}
                  </p>
                )}
              </>
            )}
          </article>
          <article className="card">
            <h2>Kalıcı seçim sonuçları</h2>
            <ul className="ledger">
              {data.elections
                .filter((e) => e.status === "elected" || e.status === "failed")
                .map((e) => (
                  <li key={e.id}>
                    <div>
                      {e.winner_id
                        ? `${username(e.winner_id)} seçildi`
                        : e.result_reason}
                      <small>
                        {time(e.voting_end)} · Katılım şartı {e.quorum}/
                        {e.electorate_size}
                      </small>
                    </div>
                  </li>
                ))}
            </ul>
            <p className="footnote">
              Görev 14 gün sürer. Süresi dolan yönetici yeni sonuç beklenirken
              yetkisini korumaz; rutin işlemler devam eder.
            </p>
          </article>
        </div>
        <div>
          <article className="card">
            <div className="eyebrow">AİDAT VE GİDERLER</div>
            <h2>Haftalık düzen</h2>
            <p>
              Başlangıç aidatı: <strong>{s?.weekly_dues || 150} OP</strong>
            </p>
            <p className="footnote">
              İlk dönem: {s?.first_week}. Aktif sakin, son 7 günde oyuna giren
              kişidir. Temizlik: {s?.cleaning_base} + kişi başına{" "}
              {s?.cleaning_per_resident} OP. Aydınlatma/bakım:{" "}
              {s?.maintenance_base} + kişi başına {s?.maintenance_per_resident}{" "}
              OP.
            </p>
            {data.dues_rates.map((r) => (
              <p key={r.id} className="feedback">
                {r.effective_week} tarihinden itibaren aidat: {r.amount} OP
              </p>
            ))}
            <h3>Aidat tahsilatı</h3>
            <ul className="ledger">
              {data.dues_overview.map((d) => (
                <li key={d.week_start}>
                  <div>
                    {d.week_start} haftası
                    <small>
                      {d.paid_count}/{d.assessed_count} ödeme · Toplam{" "}
                      {money(d.assessed_amount)} OP
                    </small>
                    <small>
                      Tahsil {money(d.paid_amount)} OP · Bekleyen{" "}
                      {money(d.unpaid_amount)} OP
                    </small>
                  </div>
                </li>
              ))}
            </ul>
            <ul className="ledger">
              {data.operating_expenses.map((ex) => (
                <li key={ex.id}>
                  <div>
                    {ex.kind === "cleaning"
                      ? "Temizlik"
                      : "Aydınlatma ve bakım"}
                    <small>
                      {ex.week_start} · {ex.active_residents} aktif sakin ·{" "}
                      {ex.paid_at ? "Ödendi" : "Kasa yetersiz, ödeme bekliyor"}
                    </small>
                  </div>
                  <strong>{money(ex.amount)} OP</strong>
                </li>
              ))}
            </ul>
            <p className="footnote">
              Ödenemeyen giderler kasa yeterli olduğunda otomatik yeniden
              denenir; aynı gider iki kez ödenmez. Kişisel borç detayları
              yalnızca Dairem ekranında sana görünür.
            </p>
          </article>
          {isManager && (
            <article className="card">
              <div className="eyebrow">YÖNETİCİ İŞLEMLERİ</div>
              <h2>Ortak karar öner</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  perform(
                    "propose_management",
                    {
                      proposal: "dues",
                      new_dues: Number(
                        new FormData(e.currentTarget).get("amount"),
                      ),
                    },
                    "Aidat önerisi 24 saatlik oylamaya açıldı.",
                  );
                }}
              >
                <label>
                  Gelecek dönem aidatı (100–200 OP)
                  <input
                    name="amount"
                    type="number"
                    min={100}
                    max={200}
                    step={1}
                    defaultValue={150}
                    required
                  />
                </label>
                <button disabled={busy}>Aidat önerisini oylamaya aç</button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  perform(
                    "propose_management",
                    {
                      proposal: String(
                        new FormData(e.currentTarget).get("proposal"),
                      ),
                    },
                    "Ortak harcama önerisi oylamaya açıldı.",
                  );
                }}
              >
                <label>
                  Hazır bakım önerisi
                  <select name="proposal">
                    {data.expense_catalog.map((c) => (
                      <option value={c.kind} key={c.kind}>
                        {c.title} · {c.cost} OP
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={busy}>Harcama önerisini oylamaya aç</button>
              </form>
              <p className="footnote">
                Aynı anda bir yönetim teklifi. Onay için en az 2 ve sakinlerin
                yarısı kadar oy, ayrıca salt çoğunluk gerekir. Oy eşitliğinde
                ret. Harcama kabulde kasa kontrolüne tabidir.
              </p>
            </article>
          )}
          <article className="card">
            <div className="eyebrow">ORTAK MUHASEBE</div>
            <h2>Bütün gelir ve giderler</h2>
            <ul className="ledger">
              {data.treasury_history.map((t) => (
                <li key={t.id}>
                  <div>
                    {t.description}
                    <small>{time(t.created_at)}</small>
                  </div>
                  <strong className={t.amount > 0 ? "income" : ""}>
                    {t.amount > 0 ? "+" : ""}
                    {money(t.amount)} OP
                  </strong>
                </li>
              ))}
            </ul>
            {!data.treasury_history.length && (
              <p className="subtle">Henüz kasa hareketi yok.</p>
            )}
          </article>
        </div>
      </div>
    </>
  );
}
