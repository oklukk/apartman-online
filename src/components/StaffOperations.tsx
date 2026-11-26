import { staffFailure, staffReadError, type StaffView } from '../staffAccess';
import { useStaffConfirmation } from './StaffConfirmation';
import { StaffFeedback } from './StaffFeedback';
import { useCallback, useEffect, useState, useRef } from "react";
import { errorText, supabase } from "../api";
import { StaffControlCenter } from "./StaffControlCenter";
import type { StaffIdentity } from "./StaffPanel";

type StaffPlayer = {
  user_id: string;
  username: string;
  building_id: string | null;
  balance: number | null;
  can_read_balance: boolean;
};
type EconomySettings = Record<string, string | number | null>;
type StaffBuilding = {
  id: string;
  name: string;
  treasury: number | null;
  settings: EconomySettings | null;
};
type Overview = { players: StaffPlayer[]; buildings: StaffBuilding[] };
const empty: Overview = { players: [], buildings: [] };

const settingNames: Record<string, string> = {
  initial_balance: "Yeni sakin başlangıç bakiyesi",
  daily_salary: "Günlük maaş",
  side_job_reward: "Ek iş ödülü",
  weekly_dues: "Haftalık aidat",
  cleaning_base: "Temizlik sabit gideri",
  cleaning_per_resident: "Kişi başı temizlik gideri",
  maintenance_base: "Bakım sabit gideri",
  maintenance_per_resident: "Kişi başı bakım gideri",
};

export function StaffOperations({ identity, view='genel' }: { identity: StaffIdentity;view?:StaffView }) {
  const confirmationUI=useStaffConfirmation(view);
  const [loading,setLoading]=useState(true);
  const [overviewLoaded,setOverviewLoaded]=useState(false);
  const [search,setSearch]=useState('');
  const superAdmin = identity.roles.some(
    (r) => r.code === "super_admin" && r.scope_kind === "global",
  );
  const permitted = (name: string, building?: string | null) =>
    superAdmin ||
    identity.permissions.includes(name) ||
    !!(
      building &&
      identity.scoped_permissions?.some(
        (s) => s.building_id === building && s.permissions.includes(name),
      )
    );
  const hasAny = [
    "players.read",
    "players.profile.edit",
    "players.moderate",
    "players.ban",
    "governance.read",
    "governance.elections.manage",
    "governance.elections.override",
    "governance.manager.appoint",
    "staff.audit.read",
    "economy.read",
    "economy.wallet.adjust",
    "economy.treasury.adjust",
    "economy.settings.manage",
  ].some(
    (p) =>
      permitted(p) ||
      identity.scoped_permissions?.some((s) => s.permissions.includes(p)),
  );
  const request = useRef<{ key: string; id: string } | null>(null);
  const mutex = useRef(false);
  const overviewSequence=useRef(0);
  const [overview, setOverview] = useState<Overview>(empty);
  const [playerId, setPlayerId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [username, setUsername] = useState("");
  const [moneyAmount, setMoneyAmount] = useState("");
  const [treasuryAmount, setTreasuryAmount] = useState("");
  const [settingKey, setSettingKey] = useState("daily_salary");
  const [settingAmount, setSettingAmount] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase || !hasAny) return;
    const sequence=++overviewSequence.current;
    setLoading(true);
    try {
      const result = await supabase.rpc("staff_game_overview");
      if(sequence!==overviewSequence.current)return;
      if(result.error)throw result.error;
      setOverview(result.data as Overview);setOverviewLoaded(true);
    } catch(e) {if(sequence!==overviewSequence.current)return;setOverviewLoaded(false);throw e;}
    finally {if(sequence===overviewSequence.current)setLoading(false);}

  }, [hasAny, identity]);

  useEffect(() => {
    setOverview(empty);setOverviewLoaded(false);
    void refresh().catch((e: unknown) =>
      setStatus(staffReadError(errorText(e))),
    );
  }, [refresh]);

  const chosenPlayer = overview.players.find((p) => p.user_id === playerId);
  const chosenBuilding = overview.buildings.find((b) => b.id === buildingId);
  const reasonValid = reason.trim().length >= 5 && reason.trim().length <= 500;

  async function submit(
    action: string,
    args: Record<string, unknown>,
    confirmation: string,
  ) {
    if (!supabase || mutex.current || !reasonValid || !overviewLoaded) return;
    if (!await confirmationUI.ask({title:'Değişikliği onayla',summary:confirmation,details:{
      'Oyuncu':overview.players.find(p=>p.user_id===args.target_user)?.username || '—',
      'Apartman':overview.buildings.find(b=>b.id===(args.target_building || chosenPlayer?.building_id))?.name || '—',
      ...(args.amount!==undefined?{'Değişim miktarı':String(args.amount)+' OP'}:{}),
      ...(args.setting_key?{'Mevcut değer':String(chosenBuilding?.settings?.[args.setting_key==='weekly_dues'?'weekly_dues_next_week':String(args.setting_key)] ?? '—'),'Yeni değer':String(args.new_value)+' OP'}:{}),
      'Gerekçe':reason.trim(),
    }})) return;
    const clean = { ...args };
    delete clean.operation_id;
    const key = JSON.stringify({ action, args: clean, reason: reason.trim() });
    if (request.current?.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    mutex.current = true;
    setBusy(true);
    setStatus("");
    try {
      const res = await supabase.rpc(action, {
        ...clean,
        operation_id: request.current.id,
        reason: reason.trim(),
      });
      if (res.error) throw res.error;
      request.current = null;
      setStatus(
        "Yönetim işlemi kaydedildi. İşlem geçmişinden kontrol edebilirsiniz.",
      );
      setMoneyAmount("");
      setTreasuryAmount("");
      try {await refresh();} catch {setStatus("İşlem sunucuda kaydedildi; görünüm yenilenemedi. Geçmişi kontrol edip verileri tekrar yükleyin.");}
    } catch (e) {
      setStatus(staffFailure(e,true) || "İşlem uygulanamadı: " + errorText(e));
    } finally {
      mutex.current = false;
      setBusy(false);
    }
  }

  if (!hasAny) return null;
  const userCanEdit =
    chosenPlayer && permitted("players.profile.edit", chosenPlayer.building_id);
  const userCanMoney =
    chosenPlayer &&
    permitted("economy.wallet.adjust", chosenPlayer.building_id) && chosenPlayer.can_read_balance && Number.isSafeInteger(chosenPlayer.balance);
  const buildingCanMoney =
    chosenBuilding && permitted("economy.treasury.adjust", chosenBuilding.id) && Number.isSafeInteger(chosenBuilding.treasury);
  const buildingCanSettings =
    chosenBuilding && permitted("economy.settings.manage", chosenBuilding.id);

  return (
    <section
      className="staff-operations"
      aria-label="Gelişmiş yönetim işlemleri"
    >
      <div hidden={view!=='genel'} className="staff-overview-data"><h2>Erişilebilir kayıtlar</h2><p className="footnote">Bu oturum için mevcut API'nin döndürdüğü kapsamdır; oyunun genel toplamı değildir.</p>{loading?<p role="status">Yönetim bilgileri yükleniyor…</p>:!overviewLoaded?<p>Veriler alınamadı. Yeniden yükleyebilirsiniz.</p>:<dl><div><dt>Oyuncu kaydı</dt><dd>{overview.players.length}</dd></div><div><dt>Apartman kaydı</dt><dd>{overview.buildings.length}</dd></div></dl>}<button className="secondary" disabled={busy || loading} onClick={()=>void refresh().catch(e=>setStatus(staffReadError(errorText(e))))}>Bilgileri yenile</button></div>
      <div hidden={view!=='oyuncular' && view!=='ekonomi'}>
        <article className="card">
          <div className="eyebrow">GELİŞMİŞ YÖNETİM</div>
          <h2>{view==='ekonomi'?'Ekonomi işlemleri':'Oyuncu işlemleri'}</h2>
          <p className="subtle">
            Yalnızca yetkili olduğunuz oyuncu ve apartmanlarda işlem yapabilirsiniz.
            Bakiye düzeltmeleri para hareketlerine kalıcı olarak kaydedilir.
          </p>
          {loading && <p role="status">Yönetim bilgileri yükleniyor…</p>}
          <label>
            İşlem gerekçesi
            <textarea
              rows={2}
              value={reason}
              minLength={5}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Değişikliğin nedenini yazın"
            />
          </label>
          <button type="button" className="secondary" disabled={busy || loading} onClick={()=>void refresh().catch(e=>setStatus(staffReadError(errorText(e))))}>Bilgileri yenile</button>
        </article>

        {overviewLoaded && !loading && !overview.players.length && <p className="empty-state">Bu oturum için erişilebilir oyuncu kaydı yok.</p>}
        {overview.players.length > 0 && (
          <article className="card">
            <h2>{view==='ekonomi'?'Kişisel cüzdan':'Oyuncu seçimi'}</h2>
            <label>Oyuncu ara<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPlayerId('');}} placeholder="Kullanıcı adıyla ara"/></label>
            <label>
              Oyuncu
              <select
                value={playerId}
                onChange={(e) => {
                  setPlayerId(e.target.value);
                  setUsername(
                    overview.players.find((p) => p.user_id === e.target.value)
                      ?.username || "",
                  );
                }}
              >
                <option value="">Oyuncu seçin</option>
                {overview.players.filter(p=>p.username.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))).map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.username} · {p.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            {view==='ekonomi' && chosenPlayer && (
              <p className="subtle">
                {chosenPlayer.can_read_balance
                  ? "Cüzdan: " + chosenPlayer.balance + " OP"
                  : "Cüzdan bilgisi erişime kapalı."}
              </p>
            )}
            <div hidden={view!=='oyuncular'}>
            {userCanEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(
                    "staff_rename_player",
                    {
                      target_user: playerId,
                      new_username: username.trim(),
                    },
                    "Oyuncunun görünen kullanıcı adı değiştirilsin mi?",
                  );
                }}
              >
                <h3>Kullanıcı adını değiştir</h3>
                <label>
                  Yeni ad
                  <input
                    value={username}
                    pattern="[A-Za-z0-9_]{3,20}"
                    required
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </label>
                <button disabled={busy || !overviewLoaded || !reasonValid}>Adı kaydet</button>
              </form>
            )}
            </div>
            <div hidden={view!=='ekonomi'}>
            {userCanMoney && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const amount = Number(moneyAmount);
                  if (!Number.isSafeInteger(amount) || amount === 0) return;
                  void submit(
                    "staff_adjust_wallet",
                    {
                      target_user: playerId,
                      amount,
                      operation_id: crypto.randomUUID(),
                    },
                    "Önizleme: " +
                      chosenPlayer.balance +
                      " → " +
                      ((chosenPlayer.balance || 0) + amount) +
                      " OP. " +
                      amount +
                      " OP düzeltme uygulansın mı?",
                  );
                }}
              >
                <h3>Oyuncu bakiyesini düzelt</h3>
                <p className="subtle">
                  Pozitif miktar ekler, negatif miktar düşer.
                </p>
                <label>
                  Değişim miktarı (OP)
                  <input
                    type="number"
                    step="1"
                    min="-1000000"
                    max="1000000"
                    value={moneyAmount}
                    onChange={(e) => setMoneyAmount(e.target.value)}
                    required
                  />
                </label>
                <button
                  disabled={
                    busy ||
                    !overviewLoaded || !reasonValid ||
                    !moneyAmount ||
                    Number(moneyAmount) === 0
                  }
                >
                  Bakiyeyi düzelt
                </button>
              </form>
            )}
            </div>
          </article>
        )}

        <div hidden={view!=='ekonomi'}>
        {overview.buildings.length > 0 && (
          <article className="card">
            <h2>Apartman ekonomisi</h2>
            <label>
              Apartman
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
              >
                <option value="">Apartman seçin</option>
                {overview.buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            {chosenBuilding && chosenBuilding.treasury !== null && (
              <p className="subtle">Kasa: {chosenBuilding.treasury} OP</p>
            )}
            {buildingCanMoney && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const amount = Number(treasuryAmount);
                  if (!Number.isSafeInteger(amount) || amount === 0) return;
                  void submit(
                    "staff_adjust_treasury",
                    {
                      target_building: buildingId,
                      amount,
                      operation_id: crypto.randomUUID(),
                    },
                    "Önizleme: " +
                      chosenBuilding.treasury +
                      " → " +
                      ((chosenBuilding.treasury || 0) + amount) +
                      " OP. Kasa düzeltmesi uygulansın mı?",
                  );
                }}
              >
                <h3>Kasa düzeltmesi</h3>
                <label>
                  Değişim miktarı (OP)
                  <input
                    type="number"
                    step="1"
                    min="-1000000"
                    max="1000000"
                    value={treasuryAmount}
                    onChange={(e) => setTreasuryAmount(e.target.value)}
                    required
                  />
                </label>
                <button
                  disabled={
                    busy ||
                    !overviewLoaded || !reasonValid ||
                    !treasuryAmount ||
                    Number(treasuryAmount) === 0
                  }
                >
                  Kasayı düzelt
                </button>
              </form>
            )}
            {buildingCanSettings && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const amount = Number(settingAmount);
                  if (!Number.isSafeInteger(amount)) return;
                  void submit(
                    "staff_update_economy",
                    {
                      target_building: buildingId,
                      setting_key: settingKey,
                      new_value: amount,
                    },
                    settingKey === "weekly_dues"
                      ? "Haftalık aidat gelecek pazartesiden itibaren " + amount + " OP olsun mu? Bu haftaki borçlar değişmez."
                      : settingNames[settingKey] + " değeri " + amount + " OP olarak değiştirilsin mi?",
                  );
                }}
              >
                <h3>Ekonomi parametreleri</h3>
                <label>
                  Değiştirilecek ayar
                  <select
                    value={settingKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      setSettingKey(key);
                      setSettingAmount(
                        String(
                          key === "weekly_dues"
                            ? (chosenBuilding?.settings?.weekly_dues_next_week ?? "")
                            : (chosenBuilding?.settings?.[key] ?? ""),
                        ),
                      );
                    }}
                  >
                    {Object.entries(settingNames).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {chosenBuilding.settings && (
                  settingKey === "weekly_dues" ? (
                    <div className="subtle">
                      <p>Bu haftanın aidatı: {String(chosenBuilding.settings.weekly_dues ?? "—")} OP</p>
                      <p>Gelecek hafta ({String(chosenBuilding.settings.weekly_dues_next_week_starts ?? "—")})
                      için geçerli/planlı aidat: {String(chosenBuilding.settings.weekly_dues_next_week ?? "—")} OP</p>
                      <p>Değişiklik gelecek pazartesi yürürlüğe girer. Bu haftanın borçlarını değiştirmez.</p>
                    </div>
                  ) : (
                    <p className="subtle">
                      Mevcut değer: {String(chosenBuilding.settings[settingKey] ?? "—")} OP
                    </p>
                  )
                )}
                <label>
                  Yeni değer
                  <input
                    type="number"
                    step="1"
                    min={settingKey === "weekly_dues" ? 1 : 0}
                    max={settingKey === "weekly_dues" ? 100000 : 1000000}
                    value={settingAmount}
                    onChange={(e) => setSettingAmount(e.target.value)}
                    required
                  />
                </label>
                <button disabled={busy || !overviewLoaded || !reasonValid || settingAmount === ""}>
                  Ayarı güncelle
                </button>
                <p className="subtle">
                  Yeni değer gelecekteki işlemleri etkiler; geçmiş maaş ve borçlar
                  yeniden hesaplanmaz.
                </p>
              </form>
            )}
          </article>
        )}
        </div>
      </div>
      <StaffFeedback message={status}/>
      {confirmationUI.dialog}
      <StaffControlCenter
        identity={identity}
        view={view}
        players={overview.players}
        buildings={overview.buildings}
      />
    </section>
  );
}
