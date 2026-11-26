import { staffCan, staffHasAny, staffFailure, type StaffView } from '../staffAccess';
import { StaffConfirmation } from './StaffConfirmation';
import { StaffFeedback } from './StaffFeedback';
import { uiText } from "../uiText";
import { useState, useRef, useEffect } from "react";
import { supabase, errorText, time } from "../api";
import type { StaffIdentity } from "./StaffPanel";
type RecordRow = Record<string, unknown>;
type State = {
  elections: RecordRow[];
  candidates: RecordRow[];
  votes: RecordRow[];
  manager_terms: RecordRow[];
  polls: RecordRow[];
  treasury: number;
};
type Preview = { state: State; revision: string };
type Props = {
  identity: StaffIdentity;
  view?: StaffView;
  players: { user_id: string; username: string; building_id: string | null }[];
  buildings: { id: string; name: string }[];
};
const actionPermissions: Record<string, string> = {
  "election.start": "governance.elections.manage",
  "election.restart": "governance.elections.manage",
  "election.cancel": "governance.elections.manage",
  "election.schedule": "governance.elections.manage",
  "election.resolve": "governance.elections.manage",
  "election.force": "governance.elections.override",
  "manager.appoint": "governance.manager.appoint",
  "manager.dismiss": "governance.manager.appoint",
  "manager.term": "governance.manager.appoint",
  "poll.cancel": "governance.elections.manage",
  "poll.resolve": "governance.elections.manage",
  "poll.force_accept": "governance.elections.override",
  "poll.force_reject": "governance.elections.override",
};
const labels: Record<string, string> = {
  "election.start": "Yeni / olağanüstü seçim başlat",
  "election.restart": "Açık seçimi geçmişte tutup yeniden başlat",
  "election.cancel": "Seçimi iptal et (24 saat bekleme)",
  "election.schedule": "Adaylık ve oy sürelerini değiştir",
  "election.resolve": "Mevcut oylarla normal sonuçlandır",
  "election.force": "Katılımdan bağımsız aday seç",
  "manager.appoint": "Doğrudan yönetici ata (14 gün)",
  "manager.dismiss": "Etkin ve planlanmış yönetici görevlerini kaldır",
  "manager.term": "Yönetici görev bitişini değiştir",
  "poll.cancel": "Açık ortak kararı iptal et",
  "poll.resolve": "Ortak kararı normal sonuçlandır",
  "poll.force_accept": "Ortak kararı zorunlu kabul et (bütçe korunur)",
  "poll.force_reject": "Ortak kararı zorunlu reddet",
};
export function StaffControlCenter({ identity, players, buildings,view='genel' }: Props) {
  const [building, setBuilding] = useState(""),
    [user, setUser] = useState(""),
    [reason, setReason] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const [sanction, setSanction] = useState("warning"),
    [until, setUntil] = useState(""),
    [sanctions, setSanctions] = useState<RecordRow[]>([]),
    [history, setHistory] = useState<RecordRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null),
    [pending, setPending] = useState<{
      rpc: string;
      args: Record<string, unknown>;
      id: string;
      label: string;
    } | null>(null);
  const [action, setAction] = useState("election.start"),
    [election, setElection] = useState(""),
    [term, setTerm] = useState(""),
    [poll, setPoll] = useState(""),
    [nomEnd, setNomEnd] = useState(""),
    [voteEnd, setVoteEnd] = useState(""),
    [termEnd, setTermEnd] = useState("");
  const mutex = useRef(false);
  const readSequence=useRef(0);
  const sanctionContext=useRef('');sanctionContext.current=building+'|'+user;
  const [loading,setLoading]=useState(false);
  const [historyLoaded,setHistoryLoaded]=useState(false);
  const [sanctionsLoaded,setSanctionsLoaded]=useState(false);
  useEffect(() => {
    setPreview(null);
    setHistory([]);setHistoryLoaded(false);
    setSanctions([]);setSanctionsLoaded(false);
    setPending(null);
  }, [identity]);
  useEffect(()=>{++readSequence.current;setLoading(false);if(!mutex.current)setPending(null);},[view]);
  const allowed = (p: string) =>
    identity.permissions.includes(p) ||
    identity.roles.some(
      (r) => r.code === "super_admin" && r.scope_kind === "global",
    ) ||
    !!identity.scoped_permissions?.some(
      (s) => s.building_id === building && s.permissions.includes(p),
    );
  const modulePermissions=view==='oyuncular'?['players.moderate','players.ban']:view==='secimler'?['governance.read',...Object.values(actionPermissions)]:view==='gecmis'?['staff.audit.read']:[];
  const scopedTargets=(identity.scoped_permissions||[]).filter(s=>s.permissions.some(p=>modulePermissions.includes(p))).map(s=>({id:s.building_id,name:buildings.find(b=>b.id===s.building_id)?.name || 'Apartman kapsamı · '+s.building_id.slice(0,8)}));
  const options=[...new Map([...buildings,...scopedTargets].map(b=>[b.id,b])).values()].filter(b=>modulePermissions.some(p=>staffCan(identity,p,b.id)));
  const scopeAllowed=options.some(b=>b.id===building);
  const actions=Object.keys(labels).filter(key=>allowed(actionPermissions[key]));
  const selectedAction=actions.includes(action)?action:actions[0] || '';
  const sanctionKeys=['warning','mute','unmute','ban','unban'].filter(key=>allowed(['ban','unban'].includes(key)?'players.ban':'players.moderate'));
  const selectedSanction=sanctionKeys.includes(sanction)?sanction:sanctionKeys[0] || '';
  const validReason = reason.trim().length >= 5 && reason.trim().length <= 500;
  async function read(rpc: string, args: Record<string, unknown>) {
    if (!supabase) throw Error("Bağlantı yok.");
    const r = await supabase.rpc(rpc, args);
    if (r.error) throw r.error;
    return r.data;
  }
  async function load() {
    const sequence=++readSequence.current;
    const rememberPreview=(value:Preview)=>{if(sequence===readSequence.current)setPreview(value);};
    const rememberHistory=(value:RecordRow[])=>{if(sequence===readSequence.current){setHistory(value);setHistoryLoaded(true);}};
    setStatus("");
    setLoading(true);
    setPending(null);
    setPreview(null);
    setHistory([]);setHistoryLoaded(false);
    try {
      if (
        view==='secimler' && (Object.values(actionPermissions).some(allowed) ||
        allowed("governance.read"))
      )
        rememberPreview(
          (await read("staff_governance_state", {
            target_building: building,
          })) as Preview,
        );
      if (view==='gecmis' && allowed("staff.audit.read"))
        rememberHistory(
          (await read("staff_operations_history", {
            target_building: building,
          })) as RecordRow[],
        );
    } catch (e) {
      if(sequence===readSequence.current)setStatus(errorText(e));
    } finally {if(sequence===readSequence.current)setLoading(false);}
  }
  function stage(rpc: string, args: Record<string, unknown>, label: string) {
    if (!validReason) return;
    setStatus('');
    setPending({
      rpc,
      args: { ...args, reason: reason.trim() },
      id: crypto.randomUUID(),
      label,
    });
  }
  async function confirm() {
    if (!pending || mutex.current) return;
    mutex.current = true;
    setBusy(true);
    setStatus('');
    try {
      await read(pending.rpc, { ...pending.args, operation_id: pending.id });
      setStatus(
        "İşlem sunucuda kaydedildi. Yeni işlem öncesi verileri yenileyin.",
      );
      setPending(null);
      setPreview(null);
    } catch (e) {
      setStatus(staffFailure(e,true) || errorText(e));
    } finally {
      mutex.current = false;
      setBusy(false);
    }
  }
  const inputChanged = () => setPending(null);
  return (
    <section hidden={!['oyuncular','secimler','gecmis'].includes(view) || !staffHasAny(identity,modulePermissions)} aria-label="Oyuncu denetimi ve seçim müdahaleleri">
      <div className="staff-module-content">
        <article className="card">
          <h2>{view==='oyuncular'?'Yaptırımlar ve disiplin':view==='secimler'?'Seçimler ve yönetici görevleri':'Apartman işlem geçmişi'}</h2>
          <label>
            Apartman
            <select
              value={scopeAllowed?building:''}
              onChange={(e) => {
                ++readSequence.current;setLoading(false);setStatus('');
                setBuilding(e.target.value);
                setPreview(null);
                setPending(null);
                setHistory([]);setHistoryLoaded(false);
                setSanctions([]);setSanctionsLoaded(false);
                setUser("");
                setElection("");
                setTerm("");
                setPoll("");
              }}
            >
              <option value="">Seçin</option>
              {options.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          {view!=='oyuncular' && <button disabled={!scopeAllowed || busy || loading} onClick={() => void load()}>{loading?'Yükleniyor…':view==='gecmis'?'İşlem geçmişini yükle':'Güncel durumu yükle'}</button>}
          {!options.length && <p className="empty-state">Mevcut API bu bölüm için erişilebilir apartman döndürmedi.</p>}
          <label>
            İşlem gerekçesi
            <textarea
              value={reason}
              minLength={5}
              maxLength={500}
              onChange={(e) => {
                setReason(e.target.value);
                inputChanged();
              }}
            />
          </label>
          {loading && <p role="status">Güncel kayıtlar yükleniyor…</p>}
          <StaffFeedback message={status}/>
        </article>
        {building && scopeAllowed && (
          <>
            <article className="card" hidden={view!=='oyuncular'}>
              <h2>Oyuncu denetimi</h2>
              <label>
                Oyuncu
                <select
                  value={user}
                  onChange={(e) => {
                    setUser(e.target.value);
                    setSanctions([]);setSanctionsLoaded(false);
                    inputChanged();
                  }}
                >
                  <option value="">Seçin</option>
                  {players
                    .filter((p) => p.building_id === building)
                    .map((p) => (
                      <option value={p.user_id} key={p.user_id}>
                        {p.username}
                      </option>
                    ))}
                </select>
              </label>
              {(allowed("players.moderate") || allowed("players.ban")) && (
                <>
                  <label>
                    Yaptırım
                    <select
                      value={selectedSanction}
                      onChange={(e) => {
                        setSanction(e.target.value);
                        inputChanged();
                      }}
                    >
                      {[
                        ["warning", "Uyarı / disiplin kaydı"],
                        ["mute", "Sustur"],
                        ["unmute", "Susturmayı kaldır"],
                        ["ban", "Oyunu tamamen durdur / banla"],
                        ["unban", "Banı kaldır"],
                      ]
                        .filter(([k]) =>
                          allowed(
                            ["ban", "unban"].includes(k)
                              ? "players.ban"
                              : "players.moderate",
                          ),
                        )
                        .map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label hidden={!['ban','mute'].includes(selectedSanction)}>
                    Bitiş (boş: süresiz)
                    <input
                      type="datetime-local"
                      value={until}
                      onChange={(e) => {
                        setUntil(e.target.value);
                        inputChanged();
                      }}
                    />
                  </label>
                  <button
                    disabled={!user || !validReason || busy}
                    onClick={() =>
                      stage(
                        "staff_sanction",
                        {
                          target_user: user,
                          action: selectedSanction,
                          until_at:
                            ["ban", "mute"].includes(selectedSanction) && until
                              ? new Date(until).toISOString()
                              : null,
                        },
                        `${uiText(selectedSanction)} · ${players.find((p) => p.user_id === user)?.username} · ${until || "Süresiz"}`,
                      )
                    }
                  >
                    Yaptırımı önizle
                  </button>
                  <button
                    className="secondary"
                    disabled={!user || busy}
                    onClick={() => {
                      const context=sanctionContext.current;
                      void read("staff_sanction_history", { target_user: user })
                        .then((d) => {if(context===sanctionContext.current){setSanctions(d as RecordRow[]);setSanctionsLoaded(true);}})
                        .catch((e) => {if(context===sanctionContext.current)setStatus(errorText(e));});
                    }}
                  >
                    Yaptırım geçmişini görüntüle
                  </button>
                </>
              )}
              {sanctionsLoaded && !sanctions.length && <p className="empty-state">Bu oyuncu için yaptırım kaydı bulunamadı.</p>}
              {sanctions.map((s) => (
                <p key={String(s.id)}>
                  {uiText(String(s.kind))} · {String(s.reason)} ·{" "}
                  {s.revoked_at
                    ? "Kaldırıldı"
                    : s.expires_at
                      ? time(String(s.expires_at))
                      : "Süresiz"}
                </p>
              ))}
            </article>
            {preview && view==='secimler' && (
              <article className="card">
                <h2>Seçimler, görevler ve ortak kararlar</h2>
                <p>
                  Önizleme: {preview.state.elections.length} seçim,{" "}
                  {preview.state.votes.length} seçim oyu; kasa{" "}
                  {preview.state.treasury} OP. Onay anında veri değişmişse sunucu
                  yeniden önizleme ister.
                </p>
                {Object.values(actionPermissions).some(allowed) ? (
                  <div>
                    <label>
                      İşlem
                      <select
                        value={selectedAction}
                        onChange={(e) => {
                          setAction(e.target.value);
                          inputChanged();
                        }}
                      >
                        {Object.entries(labels)
                          .filter(([k]) => allowed(actionPermissions[k]))
                          .map(([k, l]) => (
                            <option key={k} value={k}>
                              {l}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label hidden={!selectedAction.startsWith('election.') || selectedAction==='election.start'}>
                      Seçim
                      <select
                        value={election}
                        onChange={(e) => {
                          setElection(e.target.value);
                          inputChanged();
                        }}
                      >
                        <option value="">Seçin</option>
                        {preview.state.elections
                          .filter((e) =>
                            ["nominations", "voting"].includes(String(e.status)),
                          )
                          .map((e) => (
                            <option key={String(e.id)} value={String(e.id)}>
                              {String(e.id).slice(0, 8)} · {uiText(String(e.status))}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label hidden={!['election.force','manager.appoint'].includes(selectedAction)}>
                      Aday / atanacak sakin
                      <select
                        value={user}
                        onChange={(e) => {
                          setUser(e.target.value);
                          setSanctions([]);setSanctionsLoaded(false);
                          inputChanged();
                        }}
                      >
                        <option value="">Seçin</option>
                        {players
                          .filter((p) => p.building_id === building)
                          .map((p) => (
                            <option key={p.user_id} value={p.user_id}>
                              {p.username}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label hidden={selectedAction!=='manager.term'}>
                      Görev
                      <select
                        value={term}
                        onChange={(e) => {
                          setTerm(e.target.value);
                          inputChanged();
                        }}
                      >
                        <option value="">Seçin</option>
                        {preview.state.manager_terms
                          .filter((t) => !t.voided)
                          .map((t) => (
                            <option value={String(t.id)} key={String(t.id)}>
                              {String(t.id).slice(0, 8)} ·{" "}
                              {time(String(t.ends_at))}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label hidden={!selectedAction.startsWith('poll.')}>
                      Ortak karar
                      <select
                        value={poll}
                        onChange={(e) => {
                          setPoll(e.target.value);
                          inputChanged();
                        }}
                      >
                        <option value="">Seçin</option>
                        {preview.state.polls
                          .filter((p) => p.status === "open")
                          .map((p) => (
                            <option key={String(p.id)} value={String(p.id)}>
                              {String(p.id).slice(0, 8)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label hidden={!['election.start','election.restart','election.schedule'].includes(selectedAction)}>
                      Adaylık bitişi
                      <input
                        type="datetime-local"
                        value={nomEnd}
                        onChange={(e) => {
                          setNomEnd(e.target.value);
                          inputChanged();
                        }}
                      />
                    </label>
                    <label hidden={!['election.start','election.restart','election.schedule'].includes(selectedAction)}>
                      Oy bitişi
                      <input
                        type="datetime-local"
                        value={voteEnd}
                        onChange={(e) => {
                          setVoteEnd(e.target.value);
                          inputChanged();
                        }}
                      />
                    </label>
                    <label hidden={selectedAction!=='manager.term'}>
                      Görev bitişi
                      <input
                        type="datetime-local"
                        value={termEnd}
                        onChange={(e) => {
                          setTermEnd(e.target.value);
                          inputChanged();
                        }}
                      />
                    </label>
                    <button
                      disabled={
                        !validReason ||
                        busy ||
                        !allowed(actionPermissions[selectedAction])
                      }
                      onClick={() =>
                        stage(
                          "staff_governance_action",
                          {
                            target_building: building,
                            action: selectedAction,
                            expected_revision: preview.revision,
                            args: {
                              election_id: election || null,
                              user_id: user || null,
                              term_id: term || null,
                              poll_id: poll || null,
                              nominations_end: nomEnd
                                ? new Date(nomEnd).toISOString()
                                : null,
                              voting_end: voteEnd
                                ? new Date(voteEnd).toISOString()
                                : null,
                              ends_at: termEnd
                                ? new Date(termEnd).toISOString()
                                : null,
                            },
                          },
                          labels[selectedAction],
                        )
                      }
                    >
                      İşlemi önizle
                    </button>
                  </div>
                ) : (
                  <p>
                    Bu apartmanda yönetim müdahalesi yetkiniz yok; yalnızca durum
                    bilgilerini görebilirsiniz.
                  </p>
                )}
                <p className="footnote">
                  Tarih girişleri cihazınızın saat dilimindedir; sunucu anlık
                  zaman ve çakışmaları kontrol eder. İptal geçmişi silmez; normal
                  sonuç mevcut oyları, zorunlu sonuç seçilen geçerli adayı
                  kullanır. Görev iptalinden sonra otomatik seçim takvimi işlemeye
                  devam eder.
                </p>
              </article>
            )}
            <article className="card staff-history" hidden={view!=='gecmis'}>
              <h2>İşlem geçmişi ve telafi</h2>
              {!history.length && <p className="empty-state">{historyLoaded?'Bu apartman için kayıt bulunamadı.':'Kayıtları görmek için işlem geçmişini yükleyin.'}</p>}
              {history.map((h) => (
                <section key={String(h.id)}>
                  <h3>{uiText(String(h.action))}</h3>
                  <p>{String(h.reason)}</p>
                  <details>
                    <summary>Değişiklik ayrıntıları</summary>
                    <small>İşlem kodu: {String(h.action)}</small>
                    <pre className="staff-json">
                      {JSON.stringify(
                        { önce: h.old_value, sonra: h.new_value },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                  {["wallet.adjust", "treasury.adjust"].includes(
                    String(h.action),
                  ) && allowed(h.action==='wallet.adjust'?'economy.wallet.adjust':'economy.treasury.adjust') && (
                    <button
                      disabled={!validReason || busy}
                      onClick={() =>
                        stage(
                          "staff_compensate",
                          { original_audit_id: h.id },
                          "Bu para düzeltmesine ters kayıt ekle. Eski kayıt silinmez; yeterli bakiye ve yetki yeniden kontrol edilir.",
                        )
                      }
                    >
                      Ters kayıtla telafi et
                    </button>
                  )}
                </section>
              ))}
            </article>
          </>
        )}
      </div>
      {pending && <StaffConfirmation review={{title:'Son onay',summary:pending.label,details:{
        'Apartman':options.find(b=>b.id===pending.args.target_building)?.name || options.find(b=>b.id===building)?.name || building,
        'Oyuncu':players.find(p=>p.user_id===(pending.args.target_user || (pending.args.args as Record<string,unknown>|undefined)?.user_id || history.find(h=>h.id===pending.args.original_audit_id)?.target_id))?.username || '—',
        'Gerekçe':String(pending.args.reason || ''),
        ...Object.fromEntries(Object.entries((pending.args.args as Record<string,unknown>) || {}).filter(([key,value])=>value && key!=='user_id').map(([key,value])=>[{election_id:'Seçim',term_id:'Görev',poll_id:'Ortak karar',nominations_end:'Adaylık bitişi',voting_end:'Oy bitişi',ends_at:'Görev bitişi'}[key] || key,/_end$|ends_at/.test(key)?time(String(value)):String(value)])),
        ...(pending.args.original_audit_id?{'Kaynak kayıt':String(pending.args.original_audit_id)}:{}),
        'İşlem kimliği':pending.id,
      }}} busy={busy} message={status} onConfirm={()=>void confirm()} onCancel={()=>setPending(null)}/>}

    </section>
  );
}
