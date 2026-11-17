import { useCallback, useEffect, useState } from "react";
import { supabase, errorText } from "../api";
import { StaffMfa } from "./StaffMfa";
import { StaffOperations } from "./StaffOperations";

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

export function StaffPanel({ identity }: { identity: StaffIdentity }) {
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
    const { data, error } = await supabase.rpc("staff_directory");
    if (error) {
      setDirectory(null);
      throw error;
    }
    setDirectory(data as Directory);
  }, [canRead, identity]);
  useEffect(() => {
    setDirectory(null);
    void reload().catch((e: unknown) =>
      setStatus("Dizin yüklenemedi: " + errorText(e)),
    );
  }, [reload]);

  async function run(action: string, args: Record<string, unknown>) {
    if (!supabase || busy || !reasonValid) return;
    setBusy(true);
    setStatus("");
    try {
      const { error } = await supabase.rpc(action, {
        ...args,
        reason: reason.trim(),
      });
      if (error) throw error;
      await reload();
      setStatus("İşlem kaydedildi.");
    } catch (e) {
      setStatus("İşlem başarısız: " + errorText(e));
    } finally {
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
    <section className="staff-panel">
      <header className="page-heading">
        <div>
          <div className="eyebrow">SİSTEM YÖNETİM MERKEZİ</div>
          <h1>Yetki ve rol yönetimi</h1>
          <p className="subtle">
            Roller sunucu tarafından doğrulanır. Her değişiklik gerekçesiyle
            kaydedilir.
          </p>
        </div>
      </header>
      {!!status && (
        <div className="notice" role="status">
          {status}
        </div>
      )}
      <article className="card">
        <h2>Yetkilerim</h2>
        {identity.roles.map((r, i) => (
          <p key={i}>
            {r.title} —{" "}
            {r.scope_kind === "global" ? "Tüm oyun" : "Apartman kapsamı"}
          </p>
        ))}
        {!identity.roles.length && <p>Tanımlı rol yok.</p>}
      </article>
      {!canRead && (
        <p>Yetki dizinini görüntülemek için ayrıca izin gereklidir.</p>
      )}
      <StaffMfa />
      <StaffOperations identity={identity} />
      {directory && (
        <>
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
            <article className="card">
              <h2>Kullanıcıya yetki ver</h2>
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
                  İkinci bir Süper Yönetici atamak için MFA/AAL2 oturumu
                  gerekir.
                </p>
              )}
            </article>
          )}
          <article className="card">
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
                    · {a.role} · {a.scope_kind}
                  </small>
                </span>
                {isSuper && (
                  <button
                    className="text-button"
                    disabled={busy || !reasonValid}
                    onClick={() => {
                      if (window.confirm("Rol ataması kaldırılsın mı?"))
                        void run("staff_revoke", { assignment_id: a.id });
                    }}
                  >
                    Kaldır
                  </button>
                )}
              </div>
            ))}
          </article>
          {isSuper && (
            <article className="card">
              <h2>Yeni özel rol</h2>
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
            </article>
          )}
          {isSuper && (
            <article className="card">
              <h2>Rol izinlerini düzenle</h2>
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
            </article>
          )}
          {canRename && (
            <article className="card">
              <h2>Apartman adını düzenle</h2>
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
                    {directory.buildings.map((b) => (
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
            </article>
          )}
          {(isSuper || identity.permissions.includes("staff.audit.read")) && (
            <article className="card">
              <h2>İşlem geçmişi</h2>
              {directory.audit.map((entry, i) => (
                <div key={i} className="staff-audit">
                  <strong>{entry.action}</strong> · {entry.target_type}
                  <p className="subtle">
                    {entry.reason} ·{" "}
                    {new Date(entry.created_at).toLocaleString("tr-TR")}
                  </p>
                </div>
              ))}
              {!directory.audit.length && <p>Henüz kayıt yok.</p>}
            </article>
          )}
        </>
      )}
    </section>
  );
}
