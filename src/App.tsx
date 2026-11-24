import { StaffPanel, getStaffIdentity } from "./components/StaffPanel";
import { StaffMfa } from "./components/StaffMfa";
import type { StaffIdentity } from "./components/StaffPanel";
import { EconomyPanel } from "./components/EconomyPanel";
import { GovernancePanel } from "./components/GovernancePanel";
import { economyTables } from "./economy";
import type { EconomyData, Perform } from "./economy";
import { PollCard } from "./components/PollCard";
import { ActivityFeed } from "./components/ActivityFeed";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { Session } from "@supabase/supabase-js";
import { supabase as client, errorText, money, time } from "./api";
import type { Message, Poll } from "./api";
import "./style.css";
import "./styles/tokens.css";
import "./styles/navigation.css";
import { AppShell } from './components/AppShell';
import { SectionNav } from './components/SectionNav';
import { MyProfile, SettingsScreen } from './components/AccountScreens';
import { TodayScreen, HomeScene, BuildingScene, Announcements, EmptyIllustration } from './components/PlayerScenes';
import './styles/player-screens.css';
import { useRouteFocus } from './useRouteFocus';
import { useNavigation } from './useNavigation';
import { routeAccess, routeHref, routeLabel, sectionOf } from './navigation';
import { currentTerm } from './economy';
import type { Data } from "./gameData";
import { publicApartments, type ResidentPublicInfo } from './social';
import { useQuickProfile } from './useQuickProfile';
import { Avatar } from './components/Avatar';
import { ResidentDirectory } from './components/BuildingWorld';
import { ResidentFullProfile, ResidentQuickProfile } from './components/ResidentProfiles';
import './styles/social-world.css';
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const quick = useQuickProfile(session?.user.id);
  const [socialNow, setSocialNow] = useState(Date.now);
  const [starting, setStarting] = useState(true);
  const [staff, setStaff] = useState<StaffIdentity>({
    roles: [],
    permissions: [],
  });
  const [data, setData] = useState<Data | null>(null);
  const route = useNavigation();
  const tab = routeLabel(route);
  const section = sectionOf(route);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("Bağlanıyor");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("apartman-theme") || "system",
  );
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [older, setOlder] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState(true);
  const [chatDraft, setChatDraft] = useState("");
  const chatPosition = useRef(0);
  const restoreChat = useCallback((node: HTMLDivElement | null) => { if (node) node.scrollTop = chatPosition.current; }, []);
  const [report, setReport] = useState<string | null>(null);
  const requestNumber = useRef(0);
  const activeUser = useRef<string | undefined>(undefined);
  activeUser.current = session?.user.id;
  const load = useCallback(async () => {
    if (!client || !session) return;
    const request = ++requestNumber.current;
    try {
      const names: (keyof Data)[] = [
        ...economyTables,
        "profiles",
        "memberships",
        "apartments",
        "buildings",
        "messages",
        "polls",
        "events",
        "activity",
        "announcements",
        "votes",
        "blocks",
        "treasury_transactions",
      ];
      const rows = await Promise.all(
        names.map(async (name) => {
          if (name === "dues_overview") {
            const result = await client!.rpc("dues_overview");
            if (result.error) throw result.error;
            return [name, result.data];
          }
          let query = client!.from(name).select("*");
          if (name === "messages" || name === "activity")
            query = query
              .order("created_at", { ascending: false })
              .limit(name === "messages" ? 50 : 30);
          if (name === "messages")
            query = query.order("id", { ascending: false });
          if (name === "wallet_transactions" || name === "treasury_history")
            query = query.order("created_at", { ascending: false });
          if (name === "elections")
            query = query.order("starts_at", { ascending: false });
          if (name === "polls")
            query = query.order("ends_at", { ascending: false });
          const result = await query;
          if (result.error) throw result.error;
          return [name, result.data];
        }),
      );
      if (
        activeUser.current === session.user.id &&
        request === requestNumber.current
      )
        setData(Object.fromEntries(rows) as Data);
    } catch (e) {
      if (activeUser.current === session.user.id) setNotice(errorText(e));
    }
  }, [session?.user.id]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("apartman-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!client) {
      setStarting(false);
      return;
    }
    client!.auth.getSession().then(({ data, error }) => {
      if (error) setNotice(errorText(error));
      setSession(data.session);
      setStarting(false);
    });
    const { data: sub } = client!.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setStarting(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    setData(null);
    setOlder([]);
    setChatDraft("");
    chatPosition.current = 0;
    setHasOlder(true);
    void load();
  }, [load]);
  useEffect(() => {
    if (!session) {
      setStaff({ roles: [], permissions: [] });
      return;
    }
    let cancelled = false;
    setStaff({ roles: [], permissions: [] });
    const refresh = () => {
      void getStaffIdentity()
        .then((value) => {
          if (!cancelled) {
            setStaff(value);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setStaff({ roles: [], permissions: [] });
            setNotice(errorText(err));
          }
        });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [session?.user.id]);
  const me = data?.memberships.find((m) => m.user_id === session?.user.id);
  const myProfile = data?.profiles.find((p) => p.id === session?.user.id);
  const myApartment = data?.apartments.find((a) => a.id === me?.apartment_id);
  const building = data?.buildings.find(b => b.id === me?.building_id);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = Date.now();
      setSocialNow(now);
      const next = data?.manager_terms.flatMap(t => [Date.parse(t.starts_at),Date.parse(t.ends_at)]).filter(t => t > now).sort((a,b) => a-b)[0];
      if (next) timer = setTimeout(update,Math.min(next-now+1,2147483647));
    };
    update();
    return () => clearTimeout(timer);
  }, [data?.manager_terms]);
  const units = publicApartments(session?.user.id || '', building, data?.profiles || [], data?.memberships || [], data?.apartments || [], data?.manager_terms || [], socialNow);
  const residents = units.flatMap(a => a.resident ? [a.resident] : []);
  const openResident = (resident: ResidentPublicInfo, trigger: HTMLElement) => quick.open(resident.userId,trigger);
  useEffect(() => {
    if (!client || !me) return;
    let reloadTimer: ReturnType<typeof setTimeout>;
    const queueLoad = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        void load();
      }, 150);
    };
    const channel = client!.channel(`building-${me.building_id}`);
    for (const table of [
      "wallets",
      "dues",
      "operating_expenses",
      "treasury_entries",
      "elections",
      "election_candidates",
      "election_votes",
      "manager_terms",
      "dues_rates",
      "messages",
      "memberships",
      "polls",
      "buildings",
      "activity",
    ]) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${table === "buildings" ? "id" : "building_id"}=eq.${me.building_id}`,
        },
        queueLoad,
      );
    }
    channel.subscribe((status) => {
      setLive(
        status === "SUBSCRIBED"
          ? "Canlı bağlantı"
          : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
            ? "Bağlantı yenileniyor"
            : "Bağlanıyor",
      );
      if (status === "SUBSCRIBED") void load();
    });
    const tick = async () => {
      const activityResult = await client!.rpc("player_action", {
        action: "heartbeat",
      });
      if (activityResult.error) setNotice(errorText(activityResult.error));
      const r = await client!.rpc("settle_polls");
      if (r.error) setNotice(errorText(r.error));
      void load();
    };
    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 30000);
    const focus = () => {
      void tick();
    };
    window.addEventListener("focus", focus);
    return () => {
      void client!.removeChannel(channel);
      clearInterval(interval);
      clearTimeout(reloadTimer);
      window.removeEventListener("focus", focus);
    };
  }, [me?.building_id, load]);
  const access = { authenticated: !!session, resident: !!me, staff: staff.roles.length > 0 };
  const allowed = routeAccess(route, access);
  const isManager = !!session && currentTerm(data?.manager_terms || [])?.user_id === session.user.id;
  useRouteFocus(route, !starting && !!session && !!data && allowed === 'allowed' && !quick.userId, data, session?.user.id, setNotice);
  const act = async (
    work: () => PromiseLike<{ error: unknown }>,
    success?: string,
  ) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await work();
      if (result.error) throw result.error;
      if (success) setNotice(success);
      await load();
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const perform: Perform = (rpc, args, success) => {
    void act(() => client!.rpc(rpc, args), success);
  };
  const toggleResidentBlock = (id: string) => {
    if (!session || id === session.user.id || !residents.some(r => r.userId === id)) return;
    const blocked = data?.blocks.some(b => b.blocked_id === id);
    setOlder([]);
    void act(() => blocked
      ? client!.from("blocks").delete().eq("user_id",session.user.id).eq("blocked_id",id)
      : client!.from("blocks").insert({user_id:session.user.id,blocked_id:id}),
      blocked ? "Engel kaldırıldı." : "Bu komşunun mesajları gizlendi.");
  };
  const username = (id: string) =>
    data?.profiles.find((p) => p.id === id)?.username || "Komşu";
  const auth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!client) return;
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim(),
      password = String(f.get("password"));
    await act(async () => {
      if (authMode === "login")
        return client!.auth.signInWithPassword({ email, password });
      const result = await client!.auth.signUp({
        email,
        password,
        options: {
          data: { username: String(f.get("username")).trim() },
          emailRedirectTo: location.origin + import.meta.env.BASE_URL,
        },
      });
      if (!result.error)
        setNotice(
          result.data.session
            ? "Hesabınız hazır. Davetiyenizle katılabilirsiniz."
            : "E-postanıza gelen doğrulama bağlantısını açıp giriş yapın.",
        );
      return result;
    });
  };
  const pollCard = (poll: Poll) => (
    <section className="route-target" id={'poll-'+poll.id} key={poll.id} tabIndex={-1}>
    <PollCard
      poll={poll}
      event={data?.events.find((e) => e.id === poll.event_id)}
      vote={data?.votes.find((v) => v.poll_id === poll.id)}
      busy={busy}
      onVote={(approve) =>
        void act(
          () => client!.rpc("cast_vote", { target_poll: poll.id, approve }),
          "Oyunuz kaydedildi.",
        )
      }
    />
    </section>
  );
  const visibleMessages = [...new Map([...(data?.messages || []), ...older].map(m => [m.id,m])).values()]
    .filter(m => !data?.blocks.some(b => b.blocked_id === m.author_id))
    .sort((a,b) => a.created_at.localeCompare(b.created_at));
  const activity = <ActivityFeed items={data?.activity || []} />;
  return (
    <AppShell route={route} access={access} userId={session?.user.id} name={myProfile?.username || 'Hesabım'} building={building?.name || 'Çınar Apartmanı'} live={live} busy={busy} theme={theme} onTheme={setTheme} onSignOut={() => void act(() => client!.auth.signOut())}>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="Bildirimi kapat" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {starting ? (
          <p className="empty-state" role="status">Oturum kontrol ediliyor…</p>
        ) : !client ? (
          <section className="auth card">
            <div className="eyebrow">KURULUM BEKLENİYOR</div>
            <h1>APARTMAN</h1>
            <p>
              Oyun sunucusu henüz bağlanmadı. Supabase proje bağlantısı
              tamamlandığında kayıt ve giriş açılacak.
            </p>
            <p className="subtle">
              Bu ekran gerçek oyuncu veya sahte oyun verisi içermez.
            </p>
          </section>
        ) : !session ? (
          <section className="auth">
            <div className="eyebrow">KÜÇÜK BİR APARTMAN. GERÇEK KOMŞULAR.</div>
            <h1>
              Bir kapı aç.
              <br />
              <em>Birlikte yaşa.</em>
            </h1>
            <p className="intro">
              Komşularınla tanış, apartmandaki gelişmeleri takip et ve ortak
              kararların bir parçası ol.
            </p>
            <div className="card">
              <div className="auth-tabs">
                <button
                  className={authMode === "login" ? "active" : ""}
                  aria-pressed={authMode === "login"}
                  onClick={() => setAuthMode("login")}
                >
                  Giriş yap
                </button>
                <button
                  className={authMode === "signup" ? "active" : ""}
                  aria-pressed={authMode === "signup"}
                  onClick={() => setAuthMode("signup")}
                >
                  Hesap oluştur
                </button>
              </div>
              <form onSubmit={auth}>
                {authMode === "signup" && (
                  <label>
                    Kullanıcı adı
                    <input
                      name="username"
                      required
                      pattern="[A-Za-z0-9_]{3,20}"
                      minLength={3}
                      maxLength={20}
                      autoComplete="username"
                    />
                    <small>
                      3–20 karakter: İngilizce harf, rakam ve alt çizgi.
                    </small>
                  </label>
                )}
                <label>
                  E-posta
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </label>
                <label>
                  Şifre
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete={
                      authMode === "login" ? "current-password" : "new-password"
                    }
                  />
                </label>
                <button disabled={busy}>
                  {busy
                    ? "Lütfen bekleyin…"
                    : authMode === "login"
                      ? "Apartmana giriş yap"
                      : "Hesap oluştur"}
                </button>
              </form>
              <p className="footnote">
                12 daire, gerçek oyuncular. Apartmana yerleşmek için davetiye
                gerekir.
              </p>
            </div>
          </section>
        ) : tab === "Profilim" ? (
          <MyProfile name={myProfile?.username || 'Hesabım'} userId={session.user.id} resident={residents.find(r => r.userId === session.user.id)} />
        ) : tab === "Ayarlar" ? (
          <SettingsScreen theme={theme} onTheme={setTheme} />
        ) : route.page === 'security' ? (
          <section className="staff-panel">
            <div className="eyebrow">HESAP GÜVENLİĞİ</div>
            <h1>Hesap güvenliği</h1>
            <p className="subtle">
              İki aşamalı doğrulama her kullanıcı tarafından kurulabilir.
              Doğrulamayı etkinleştirmek yönetim yetkisi vermez.
            </p>
            <StaffMfa />
          </section>
        ) : route.page === 'staff' && staff.roles.length > 0 ? (
          <StaffPanel identity={staff} />
        ) : allowed === 'forbidden' ? (
          <section className="card"><h1>Sistem Yönetim Merkezi</h1><p>Bu alana erişim yetkin yok.</p><a className="route-link" href={routeHref({page:'today'})}>Oyuna dön</a></section>
        ) : !data ? (
          <p className="empty-state" role="status">Apartman bilgileri yükleniyor…</p>
        ) : !me ? (
          <section className="auth card">
            <div className="eyebrow">YENİ BİR BAŞLANGIÇ</div>
            <h1>Hoş geldin, {myProfile?.username}.</h1>
            <p>
              Çınar Apartmanı’na taşınmak için davetiye kodunu yaz. İlk boş
              daire sana ayrılacak.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = String(new FormData(e.currentTarget).get("code"));
                void act(
                  () => client!.rpc("join_building", { invite_code: code }),
                  "Çınar Apartmanı’na hoş geldiniz!",
                );
              }}
            >
              <label>
                Davetiye kodu
                <input
                  name="code"
                  required
                  maxLength={128}
                  autoComplete="off"
                />
              </label>
              <button disabled={busy}>Apartmana katıl</button>
            </form>
          </section>
        ) : route.page === 'resident' ? (
          <ResidentFullProfile resident={residents.find(r => r.userId === route.userId)} own={route.userId === session.user.id} blocked={data.blocks.some(b => b.blocked_id === route.userId)} busy={busy} back={route.from || routeHref({page:'neighbors',section:'sakinler'})} onBlock={() => toggleResidentBlock(route.userId || '')}/>
        ) : (
          <div className={'player-screens player-'+route.page+' player-view-'+(section || 'default')}>
            {tab !== 'Bugün' && <section className="page-heading">
              <div>
                <div className="eyebrow">
                  ÇINAR APARTMANI
                </div>
                <h1>
                  {tab}
                </h1>
                <p className="subtle">
                  {tab === "Komşular"
                      ? "Bir selamla başlar komşuluk."
                      : tab === "Apartman"
                        ? "Aynı çatı, ortak kararlar."
                        : "Bu apartmanda sana ait bir kapı."}
                </p>
              </div>
              <span className="apartment-badge">
                DAİRE{" "}
                <strong>{String(myApartment?.number).padStart(2, "0")}</strong>
              </span>
            </section>}
            <SectionNav route={route} manager={isManager} />
            {tab === 'Bugün' && <TodayScreen data={data} userId={session.user.id} name={myProfile?.username || 'Komşu'} />}
            {tab === 'Apartman' && section === 'kesfet' && <BuildingScene data={data} username={username} units={units} viewerId={session.user.id} target={route.target} onResident={openResident}/>}
            {tab === "Dairem" && (
              <>
                <div hidden={section !== 'daire'}><HomeScene name={myProfile?.username || 'Komşu'} number={myApartment?.number || 0} building={building?.name || ''}/></div>
                <div hidden={section === "daire"}><EconomyPanel data={data} busy={busy} perform={perform} view={section === "isler" ? "work" : "wallet"} /></div>
              </>
            )}
            {tab === "Komşular" && (
              <div className="neighbors-layout single-panel neighbor-space">
                <article className="card resident-directory" hidden={section !== 'sakinler'}>
                  <div className="eyebrow">
                    {data.memberships.length} / 12 DAİRE DOLU
                  </div>
                  <h2>Komşuların</h2>
                  <ResidentDirectory units={units} viewerId={session.user.id} busy={busy} blockedIds={data.blocks.map(b => b.blocked_id)} onResident={openResident} onBlock={toggleResidentBlock}/>

                </article>
                <article className="card chat" hidden={section !== "sohbet"}>
                  <div className="spread">
                    <h2>Komşu sohbeti</h2>
                    <span className="tag">{live}</span>
                  </div>
                  <p className="footnote">
                    Mesajlar kalıcıdır. 500 karakter · Mesajlar arası 2 saniye.
                  </p>
                  <div className="chat-history" aria-label="Sohbet geçmişi" ref={restoreChat} onScroll={e => { chatPosition.current = e.currentTarget.scrollTop; }}>
                    {hasOlder && data.messages.length >= 50 && (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            const all = [...data.messages, ...older].sort(
                              (a, b) =>
                                a.created_at.localeCompare(b.created_at) ||
                                a.id.localeCompare(b.id),
                            );
                            const oldest = all[0];
                            const r = await client!
                              .from("messages")
                              .select("*")
                              .or(
                                `created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`,
                              )
                              .order("created_at", { ascending: false })
                              .order("id", { ascending: false })
                              .limit(50);
                            if (!r.error) {
                              setOlder((prev) => [
                                ...prev,
                                ...(r.data as Message[]),
                              ]);
                              setHasOlder(r.data.length === 50);
                            }
                            return r;
                          })
                        }
                      >
                        Önceki mesajlar
                      </button>
                    )}
                    {visibleMessages                      .map((m) => (
                        <div
                          className={`message ${m.author_id === session.user.id ? "own" : ""}`}
                          key={m.id}
                        >
                          <div className="spread">
                            <button type="button" className="chat-person" aria-label={(residents.find(r => r.userId === m.author_id)?.username || 'Komşu')+' · komşu kartını aç'} onClick={e => quick.open(m.author_id,e.currentTarget)}><Avatar userId={m.author_id} name={residents.find(r => r.userId === m.author_id)?.username || 'Komşu'} size={36}/><strong>{residents.find(r => r.userId === m.author_id)?.username || 'Komşu'}</strong></button>
                            <time dateTime={m.created_at}>{time(m.created_at)}</time>
                          </div>
                          <p>{m.body}</p>
                          {m.author_id !== session.user.id && (
                            <button
                              className="text-button report-link"
                              onClick={() =>
                                setReport(report === m.id ? null : m.id)
                              }
                            >
                              Şikâyet et
                            </button>
                          )}
                          {report === m.id && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const reason = String(
                                  new FormData(e.currentTarget).get("reason"),
                                );
                                void act(async () => {
                                  const r = await client!
                                    .from("message_reports")
                                    .insert({
                                      reporter_id: session.user.id,
                                      message_id: m.id,
                                      reason,
                                    });
                                  if (!r.error) setReport(null);
                                  return r;
                                }, "Şikâyet kaydedildi. Proje yöneticisi inceleyebilir.");
                              }}
                            >
                              <label>
                                Şikâyet nedeni
                                <input
                                  name="reason"
                                  required
                                  minLength={3}
                                  maxLength={300}
                                />
                              </label>
                              <button disabled={busy}>Şikâyeti gönder</button>
                            </form>
                          )}
                        </div>
                      ))}
                    {!visibleMessages.length && (
                      <EmptyIllustration kind="chat" title={data.blocks.length ? "Görüntülenecek mesaj yok" : "İlk selam senden olsun"}><p>{data.blocks.length ? "Gizlediğin komşuların mesajları burada görünmez. Sakinler bölümünden engeli kaldırabilirsin." : "Henüz mesaj yok. Komşularına ilk selamı ver."}</p></EmptyIllustration>
                    )}
                  </div>
                  <form
                    className="composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const body = String(new FormData(form).get("message"));
                      void act(async () => {
                        const r = await client!.rpc("send_message", {
                          message_body: body,
                        });
                        if (!r.error) { setChatDraft(""); form.reset(); }
                        return r;
                      });
                    }}
                  >
                    <label className="sr-only" htmlFor="message">
                      Mesajın
                    </label>
                    <textarea
                      value={chatDraft}
                      onChange={e => setChatDraft(e.target.value)}
                      id="message"
                      name="message"
                      maxLength={500}
                      required
                      rows={2}
                      placeholder="Komşularına bir şey söyle…"
                    />
                    <button disabled={busy}>Gönder</button>
                  </form>
                </article>
              </div>
            )}
            {tab === "Apartman" && section !== 'kesfet' && (
              <>
                {section === 'yonetici' && !isManager ? <p className="empty-state">Yönetici Masası yalnız görevdeki apartman yöneticisine açıktır.</p> :
                <GovernancePanel
                  data={data}
                  userId={session.user.id}
                  username={username}
                  busy={busy}
                  perform={perform}
                  view={section === 'kararlar' ? 'decisions' : section === 'yonetici' ? 'manager' : 'treasury'}
                />}
                {section === 'kasa-pano' && <Announcements data={data}/>}
                <div className="columns single-panel" hidden={section !== 'kararlar' && section !== 'kasa-pano'}>
                  <div hidden={section !== "kararlar"}>
                    {section === 'kararlar' && data.polls.map(pollCard)}
                    {section === 'kararlar' && !data.polls.length && <EmptyIllustration kind="vote" title="Henüz ortak karar yok"><p>Yeni oylamalar başladığında burada görünecek.</p></EmptyIllustration>}
                  </div>
                  <div hidden={section !== 'kasa-pano'}>
                    <article className="card">
                      <div className="eyebrow">ŞEFFAF KASA</div>
                      <div className="big-number">
                        {money(building?.treasury || 0)} <small>OP</small>
                      </div>
                      <p className="subtle">
                        Bütün gelir ve giderler yukarıdaki ortak muhasebe
                        defterinde görünür.
                      </p>
                    </article>
                    {activity}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      {quick.userId && session && <ResidentQuickProfile resident={residents.find(r => r.userId === quick.userId)} own={quick.userId === session.user.id} blocked={!!data?.blocks.some(b => b.blocked_id === quick.userId)} busy={busy} origin={route} opener={quick.opener} onClose={quick.close} onNavigate={quick.navigate} onBlock={() => toggleResidentBlock(quick.userId || '')}/>}
    </AppShell>
  );
}
