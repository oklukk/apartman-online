import { staffCan, staffModules, staffModuleVisible, staffIdentityKey, staffFailure, type StaffView } from '../staffAccess';
import { routeHref } from '../navigation';
import { useStaffConfirmation } from './StaffConfirmation';
import { StaffMfa } from './StaffMfa';
import { StaffFeedback } from './StaffFeedback';
import { uiText } from "../uiText";
import { useCallback, useEffect, useState, useMemo, useRef, lazy, Suspense } from "react";
import { supabase, errorText } from "../api";
const StaffOperations = lazy(() =>
  import("./StaffOperations").then((m) => ({ default: m.StaffOperations })),
);

export type StaffIdentity = {
  roles: {
    code: string;
    title: string;
    scope_kind: string;
    scope_id: string;
  }[];
  permissions: string[];
  scoped_permissions?: { building_id: string; permissions: string[] }[];
};
type Role = {
  id: number;
  code: string;
  title: string;
  description: string;
  system_role: boolean;
  permissions: string[];
};
type Permission = { code: string; category: string; title: string };
type User = { user_id: string; username: string };
type Building = { id: string; name: string };
type Assignment = {
  id: string;
  user_id: string;
  role: string;
  scope_kind: string;
  scope_id: string;
};
type Log = {
  old_value?: unknown;
  new_value?: unknown;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
};
type Directory = {
  roles: Role[];
  permissions: Permission[];
  users: User[];
  buildings: Building[];
  assignments: Assignment[];
  audit: Log[];
};

export async function getStaffIdentity(): Promise<StaffIdentity> {
  if (!supabase) return { roles: [], permissions: [] };
  const { data, error } = await supabase.rpc("staff_me");
  if (error) {
    // A draft branch must not break a live site before the corresponding migration.
    if (["PGRST202", "42883"].includes(error.code))
      return { roles: [], permissions: [] };
    throw error;
  }
  const raw = data as StaffIdentity | null;
  return {
    roles: Array.isArray(raw?.roles) ? raw.roles : [],
    permissions: Array.isArray(raw?.permissions) ? raw.permissions : [],
    scoped_permissions: raw?.scoped_permissions || [],
  };
}

export function StaffPanel({identity,view='genel'}:{identity:StaffIdentity;view?:string}) {
  const signature=staffIdentityKey(identity);
  const stable=useMemo(()=>identity,[signature]);
  const selected=staffModules.some(m=>m.key===view)?view as StaffView:'genel';
  return <StaffWorkspace key={signature} identity={stable} view={selected}/>;
}
function StaffWorkspace({ identity,view }: { identity: StaffIdentity;view:StaffView }) {
  const confirmation=useStaffConfirmation(view);
  const runMutex=useRef(false);
  const directorySequence=useRef(0);
  const [loading,setLoading]=useState(true);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [role, setRole] = useState("moderator");
  const [scope, setScope] = useState("global");
  const [building, setBuilding] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [editRole, setEditRole] = useState("");
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const isSuper = identity.roles.some(
    (r) => r.code === "super_admin" && r.scope_kind === "global",
  );
  const canRename =
    isSuper ||
    identity.permissions.includes("world.buildings.rename") ||
    !!identity.scoped_permissions?.some((s) =>
      s.permissions.includes("world.buildings.rename"),
    );
  const canRead =
    isSuper ||
    identity.permissions.includes("staff.roles.read") ||
    identity.permissions.includes("world.buildings.read") ||
    canRename ||
    !!identity.scoped_permissions?.some((s) =>
      s.permissions.includes("world.buildings.read"),
    );
  const reasonValid = reason.trim().length >= 5 && reason.trim().length <= 500;

  const reload = useCallback(async () => {
    if (!canRead || !supabase) return;
    const sequence=++directorySequence.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("staff_directory");
      if(sequence!==directorySequence.current)return;
      if(error)throw error;
      setDirectory(data as Directory);
    } catch(e) {if(sequence!==directorySequence.current)return;setDirectory(null);throw e;}
    finally {if(sequence===directorySequence.current)setLoading(false);}

  }, [canRead, identity]);
  useEffect(() => {
    setDirectory(null);
    if(!canRead)setLoading(false);
    void reload().catch((e: unknown) =>
      setStatus("Dizin yüklenemedi: " + errorText(e)),
    );
  }, [reload]);

  async function run(action: string, args: Record<string, unknown>) {
    if (!supabase || runMutex.current || !reasonValid) return;
    const descriptions:Record<string,string>={staff_grant:'Rol ata',staff_revoke:'Rol atamasını kaldır',staff_create_role:'Özel rol oluştur',staff_set_role_permissions:'Rol izinlerini değiştir',staff_rename_building:'Apartman adını değiştir'};
    const targetName=directory?.users.find(u=>u.user_id===args.target_user)?.username;
    const assignment=directory?.assignments.find(a=>a.id===args.assignment_id);
    const scopeKind=args.target_scope || assignment?.scope_kind;
    const scopeId=args.scope || args.target_building || assignment?.scope_id;
    const review={title:descriptions[action] || 'Yönetim işlemi',summary:'Seçili hedef ve gerekçe ile değişiklik uygulanacak. Geçmiş kayıtlar silinmez.',details:{
      'Hedef':targetName || (assignment?directory?.users.find(u=>u.user_id===assignment.user_id)?.username:undefined) || directory?.buildings.find(b=>b.id===args.target_building)?.name || String(args.role_title || args.role_code || 'Seçili kayıt'),
      'Rol / yeni değer':String(args.new_name || args.role_code || assignment?.role || ''),
      'Kapsam':scopeKind==='global' || !scopeId?'Tüm oyun':directory?.buildings.find(b=>b.id===scopeId)?.name || String(scopeId),
      ...(Array.isArray(args.permission_codes)?{'Seçilen izinler':args.permission_codes.map(code=>directory?.permissions.find(p=>p.code===code)?.title || String(code)).join(', ') || 'İzin seçilmedi'}:{}),
      'Gerekçe':reason.trim(),
    }};
    if(!await confirmation.ask(review))return;
    runMutex.current=true;
    setBusy(true);
    setStatus("");
    try {
      const { error } = await supabase.rpc(action, {
        ...args,
        reason: reason.trim(),
      });
      if (error) throw error;
      setStatus("İşlem sunucuda kaydedildi.");
      try {await reload();} catch {setStatus("İşlem sunucuda kaydedildi; dizin yenilenemedi. Yeni işlemden önce güncel kayıtları kontrol edin.");}
    } catch (e) {
      setStatus(staffFailure(e) || "İşlem başarısız: " + errorText(e));
    } finally {
      runMutex.current=false;
      setBusy(false);
    }
  }
  const grouped = (directory?.permissions || []).reduce<
    Record<string, Permission[]>
  >((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});
  const selectPermissions = (
    values: string[],
    setValues: (next: string[]) => void,
  ) => (
    <div className="staff-permissions">
      {Object.entries(grouped).map(([category, valuesForCategory]) => (
        <fieldset key={category}>
          <legend>{category}</legend>
          {valuesForCategory.map((p) => (
            <label key={p.code} className="staff-check">
              <input
                type="checkbox"
                checked={values.includes(p.code)}
                onChange={() =>
                  setValues(
                    values.includes(p.code)
                      ? values.filter((v) => v !== p.code)
                      : [...values, p.code],
                  )
                }
              />
              <span>
                {p.title} <small>{p.code}</small>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );

  return (
    <section className="staff-panel staff-center">
      <header className="page-heading">
        <div>
          <div className="eyebrow">SİSTEM YÖNETİM MERKEZİ</div>
          <h1>Yönetim merkezi</h1>
          <p className="subtle">
            Oyuncular, ekonomi ve yetkiler tek yerde. Her değişiklik
            gerekçesiyle işlem geçmişine kaydedilir.
          </p>
        </div>
      </header>
      <nav className="staff-module-nav" aria-label="Yönetim modülleri">{staffModules.filter(m=>staffModuleVisible(identity,m.key)).map(m=><a key={m.key} href={routeHref({page:'staff',section:m.key})} aria-current={view===m.key?'page':undefined}>{m.label}</a>)}</nav>
      {!staffModuleVisible(identity,view) && <p className="empty-state" role="alert">Bu modüle erişim yetkiniz yok. Yetkili olduğunuz bölümler menüde görünür.</p>}
      <div hidden={view!=='genel'}>
      <article className="card role-overview">
        <h2>Yetkilerim</h2>
        {identity.roles.map((r, i) => (
          <p key={i}>
            {r.title} —{" "}
            {r.scope_kind === "global" ? "Tüm oyun" : "Apartman kapsamı · "+(directory?.buildings.find(b=>b.id===r.scope_id)?.name || r.scope_id.slice(0,8))}
          </p>
        ))}
        {!identity.roles.length && <p>Tanımlı rol yok.</p>}
      </article>
      </div>
      <div hidden={view!=='genel'}>{canRead && <p className="subtle">Dizin bilgileri yalnız sunucunun bu oturuma açtığı kayıtlardan oluşur.</p>}</div>
      <div hidden={view!=='genel'}><details className="staff-task card"><summary>Oturumu burada doğrula</summary><p>Diğer modüllerdeki form bilgilerini kaybetmeden iki aşamalı doğrulama yapabilirsin.</p><StaffMfa/></details></div>
      <div hidden={view!=='genel'} className="staff-security-link"><a className="route-link" href={routeHref({page:'security'})}>Hesap güvenliği ve MFA</a><p className="footnote">Kritik işlemler iki aşamalı doğrulanmış oturum ister. Bu ekran doğrulama durumu varsaymaz.</p></div>
      <Suspense fallback={<p>Yönetim işlemleri yükleniyor…</p>}>
        <StaffOperations identity={identity} view={view} />
      </Suspense>
      <div hidden={view!=='roller' && view!=='gecmis'}><StaffFeedback message={status}/>{loading && canRead && <p role="status">Yetki dizini yükleniyor…</p>}{canRead && <button className="secondary" disabled={busy || loading} onClick={()=>void reload().catch(e=>setStatus('Dizin yüklenemedi: '+errorText(e)))}>Dizini yenile</button>}</div>
      {directory && (
        <div className="staff-role-content">
          {(isSuper || identity.permissions.includes('staff.roles.read')) && <div hidden={view!=='roller'}>
          <article className="card">
            <h2>Rol kataloğu</h2>
            {directory.roles.map((r) => (
              <p key={r.code}>
                <strong>{r.title}</strong> · {r.code} ·{" "}
                {r.code === "super_admin"
                  ? "Tüm izinler"
                  : r.permissions.length + " izin"}
              </p>
            ))}
          </article>
          </div>}
          <div hidden={view!=='roller'}>
          {!isSuper && <p className="empty-state">Rol atama ve izin düzenleme yetkiniz yok. Yalnız sunucunun size açtığı kayıtları ve işlemleri kullanabilirsiniz.</p>}
          {!!directory.buildings.length && <article className="card"><h2>Erişilebilir apartmanlar</h2>{directory.buildings.map(b=><p key={b.id}>{b.name}</p>)}</article>}
          {(isSuper || canRename) && (
            <article className="card">
              <h2>İşlem gerekçesi</h2>
              <label>
                Tüm rol ve ad değiştirme işlemlerinde kullanılır.
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  minLength={5}
                  maxLength={500}
                  rows={2}
                  placeholder="İşlemin nedeni"
                />
              </label>
            </article>
          )}
          {isSuper && (
            <details className="card staff-task" open><summary>Kullanıcıya yetki ver</summary><div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("staff_grant", {
                    target_user: target,
                    role_code: role,
                    target_scope: scope,
                    scope: scope === "global" ? null : building,
                  });
                }}
              >
                <label>
                  Kullanıcı
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    required
                  >
                    <option value="">Kullanıcı seçin</option>
                    {directory.users.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.username} · {u.user_id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rol
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {directory.roles.map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Kapsam
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="global">Tüm oyun</option>
                    <option value="building">Belirli apartman</option>
                  </select>
                </label>
                {scope === "building" && (
                  <label>
                    Apartman
                    <select
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      required
                    >
                      <option value="">Seçiniz</option>
                      {directory.buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  disabled={
                    busy ||
                    !target ||
                    !reasonValid ||
                    (scope === "building" && !building)
                  }
                >
                  Rol ata
                </button>
              </form>
              {role === "super_admin" && (
                <p className="subtle">
                  İkinci bir Süper Yönetici atamak için iki aşamalı doğrulanmış oturum
                  gerekir.
                </p>
              )}
            </div></details>
          )}
          {(isSuper || identity.permissions.includes("staff.roles.read")) && <article className="card">
            <h2>Mevcut rol atamaları</h2>
            {directory.assignments.map((a) => (
              <div key={a.id} className="staff-assignment">
                <span>
                  <strong>
                    {directory.users.find((u) => u.user_id === a.user_id)
                      ?.username || a.user_id.slice(0, 8)}
                  </strong>
                  <small>
                    {" "}
                    · {directory.roles.find((r) => r.code === a.role)?.title || uiText(a.role)} · {uiText(a.scope_kind)}
                  </small>
                </span>
                {isSuper && (
                  <button
                    className="text-button danger"
                    disabled={busy || !reasonValid}
                    onClick={() => void run("staff_revoke", { assignment_id: a.id })}
                  >
                    Kaldır
                  </button>
                )}
              </div>
            ))}
          </article>}
          {isSuper && (
            <details className="card staff-task"><summary>Yeni özel rol</summary><div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("staff_create_role", {
                    role_code: roleCode,
                    role_title: roleTitle,
                    role_description: "",
                    permission_codes: rolePerms,
                  });
                }}
              >
                <label>
                  Rol kodu
                  <input
                    value={roleCode}
                    onChange={(e) => setRoleCode(e.target.value)}
                    pattern="[a-z][a-z0-9_]{2,49}"
                    placeholder="etkinlik_sorumlusu"
                    required
                  />
                </label>
                <label>
                  Rol başlığı
                  <input
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    minLength={3}
                    maxLength={80}
                    required
                  />
                </label>
                {selectPermissions(rolePerms, setRolePerms)}
                <button disabled={busy || !reasonValid}>
                  Özel rolü oluştur
                </button>
              </form>
            </div></details>
          )}
          {isSuper && (
            <details className="card staff-task"><summary>Rol izinlerini düzenle</summary><div>
              <label>
                Rol
                <select
                  value={editRole}
                  onChange={(e) => {
                    setEditRole(e.target.value);
                    setEditPerms(
                      directory.roles.find((r) => r.code === e.target.value)
                        ?.permissions || [],
                    );
                  }}
                >
                  <option value="">Seçiniz</option>
                  {directory.roles
                    .filter((r) => r.code !== "super_admin")
                    .map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.title}
                      </option>
                    ))}
                </select>
              </label>
              {editRole && (
                <>
                  {selectPermissions(editPerms, setEditPerms)}
                  <button
                    disabled={busy || !reasonValid}
                    onClick={() =>
                      void run("staff_set_role_permissions", {
                        role_code: editRole,
                        permission_codes: editPerms,
                      })
                    }
                  >
                    İzinleri kaydet
                  </button>
                </>
              )}
            </div></details>
          )}
          {canRename && (
            <details className="card staff-task"><summary>Apartman adını düzenle</summary><div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("staff_rename_building", {
                    target_building: renameId,
                    new_name: renameValue.trim(),
                  });
                }}
              >
                <label>
                  Apartman
                  <select
                    value={renameId}
                    onChange={(e) => {
                      setRenameId(e.target.value);
                      setRenameValue(
                        directory.buildings.find((b) => b.id === e.target.value)
                          ?.name || "",
                      );
                    }}
                    required
                  >
                    <option value="">Seçiniz</option>
                    {directory.buildings.filter(b=>staffCan(identity,'world.buildings.rename',b.id)).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Yeni ad
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    minLength={3}
                    maxLength={80}
                    required
                  />
                </label>
                <button disabled={busy || !reasonValid || !renameId}>
                  Kaydet
                </button>
              </form>
            </div></details>
          )}
          </div>
          <div hidden={view!=='gecmis'}>
          {(isSuper || identity.permissions.includes("staff.audit.read")) && (
            <article className="card">
              <h2>İşlem geçmişi</h2>
              {directory.audit.map((entry, i) => (
                <div key={i} className="staff-audit">
                  <strong>{uiText(entry.action)}</strong> · {uiText(entry.target_type)}
                  <details>
                    <summary>Eski / yeni değerler</summary>
                    <small>İşlem kodu: {entry.action}</small>
                    <pre className="staff-json">
                      {JSON.stringify(
                        { önce: entry.old_value, sonra: entry.new_value },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                  <p className="subtle">
                    {entry.reason} ·{" "}
                    {new Date(entry.created_at).toLocaleString("tr-TR")}
                  </p>
                </div>
              ))}
              {!directory.audit.length && <p className="empty-state">Henüz yönetim işlemi kaydedilmedi.</p>}
            </article>
          )}
          </div>
        </div>
      )}
      {confirmation.dialog}
    </section>
  );
}
