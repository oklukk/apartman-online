import { PanelGroup } from "./PanelGroup";
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

export function StaffOperations({ identity }: { identity: StaffIdentity }) {
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
    const result = await supabase.rpc("staff_game_overview");
    if (result.error) throw result.error;
    setOverview(result.data as Overview);
  }, [hasAny, identity]);

  useEffect(() => {
    setOverview(empty);
    void refresh().catch((e: unknown) =>
      setStatus("Bilgiler yüklenemedi: " + errorText(e)),
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
    if (!supabase || mutex.current || !reasonValid) return;
    if (!window.confirm(confirmation)) return;
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
      await refresh();
      request.current = null;
      setStatus(
        "Yönetim işlemi kaydedildi. İşlem geçmişinden kontrol edebilirsiniz.",
      );
      setMoneyAmount("");
      setTreasuryAmount("");
    } catch (e) {
      setStatus("İşlem uygulanamadı: " + errorText(e));
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
    permitted("economy.wallet.adjust", chosenPlayer.building_id);
  const buildingCanMoney =
    chosenBuilding && permitted("economy.treasury.adjust", chosenBuilding.id);
  const buildingCanSettings =
    chosenBuilding && permitted("economy.settings.manage", chosenBuilding.id);

  return (
    <section
      className="staff-operations"
      aria-label="Gelişmiş yönetim işlemleri"
    >
      <PanelGroup
        title="Oyuncular ve ekonomi"
        description="Kullanıcı adları, kişisel bakiye, ortak kasa ve gelir-gider ayarları."
      >
        <article className="card">
          <div className="eyebrow">GELİŞMİŞ YÖNETİM</div>
          <h2>Oyuncular ve ekonomi</h2>
          <p className="subtle">
            Yalnızca yetkili olduğunuz oyuncu ve apartmanlarda işlem yapabilirsiniz.
            Bakiye düzeltmeleri para hareketlerine kalıcı olarak kaydedilir.
          </p>
          {status && <p role="status">{status}</p>}
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
        </article>

        {overview.players.length > 0 && (
          <article className="card">
            <h2>Oyuncu işlemleri</h2>
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
                {overview.players.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.username} · {p.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            {chosenPlayer && (
              <p className="subtle">
                {chosenPlayer.can_read_balance
                  ? "Cüzdan: " + chosenPlayer.balance + " OP"
                  : "Cüzdan bilgisi erişime kapalı."}
              </p>
            )}
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
                <button disabled={busy || !reasonValid}>Adı kaydet</button>
              </form>
            )}
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
                    !reasonValid ||
                    !moneyAmount ||
                    Number(moneyAmount) === 0
                  }
                >
                  Bakiyeyi düzelt
                </button>
              </form>
            )}
          </article>
        )}

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
                    !reasonValid ||
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
                <button disabled={busy || !reasonValid || settingAmount === ""}>
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
      </PanelGroup>
      <StaffControlCenter
        identity={identity}
        players={overview.players}
        buildings={overview.buildings}
      />
    </section>
  );
}
