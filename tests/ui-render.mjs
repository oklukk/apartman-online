// Static React rendering only. No browser, Auth session or WebSocket is simulated as verified.
import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { EconomyPanel } = await vite.ssrLoadModule(
    "/src/components/EconomyPanel.tsx",
  );
  const { GovernancePanel } = await vite.ssrLoadModule(
    "/src/components/GovernancePanel.tsx",
  );
  const now = Date.now(),
    iso = (n) => new Date(n).toISOString();
  const data = {
    wallets: [
      {
        user_id: "a",
        balance: 300,
        job: "office",
        job_changed_at: null,
        side_job_started_at: null,
      },
    ],
    wallet_transactions: [
      {
        id: "tx",
        amount: 300,
        balance_after: 300,
        kind: "starting",
        period_key: "once",
        description: "Bir defalık başlangıç bakiyesi",
        created_at: iso(now),
      },
    ],
    dues: [],
    operating_expenses: [],
    economy_settings: [
      {
        first_week: "2026-11-16",
        daily_salary: 100,
        side_job_reward: 25,
        weekly_dues: 150,
        cleaning_base: 80,
        cleaning_per_resident: 20,
        maintenance_base: 50,
        maintenance_per_resident: 10,
      },
    ],
    treasury_history: [],
    elections: [
      {
        id: "e",
        starts_at: iso(now - 1000),
        nominations_end: iso(now + 3600000),
        voting_end: iso(now + 3 * 86400000),
        status: "nominations",
        electorate_size: 2,
        quorum: 2,
      },
    ],
    election_candidates: [],
    election_votes: [],
    election_electorate: [{ election_id: "e", user_id: "a" }],
    manager_terms: [],
    dues_rates: [],
    expense_catalog: [{ kind: "door", title: "Kapı onarımı", cost: 300 }],
    dues_overview: [],
  };
  const props = {
    data,
    busy: false,
    perform: () => {},
    userId: "a",
    username: (id) => (id === "a" ? "Ayşe" : "Komşu"),
  };
  const economy = renderToStaticMarkup(
    React.createElement(EconomyPanel, props),
  );
  for (const text of [
    "300",
    "Ofis çalışanı",
    "Ek işe başla",
    "Henüz aidat borcun yok",
    "Günlük maaş",
  ])
    assert.ok(economy.includes(text), text);
  const resident = renderToStaticMarkup(
    React.createElement(GovernancePanel, props),
  );
  assert.ok(resident.includes("Aday ol"));
  assert.ok(!resident.includes("Ortak karar öner"));
  data.manager_terms = [
    {
      id: "term",
      user_id: "a",
      starts_at: iso(now - 1000),
      ends_at: iso(now + 14 * 86400000),
    },
  ];
  const manager = renderToStaticMarkup(
    React.createElement(GovernancePanel, props),
  );
  assert.ok(manager.includes("Ortak karar öner"));
  assert.ok(manager.includes("Aidat önerisini oylamaya aç"));
  data.elections = [];
  data.election_electorate = [];
  data.manager_terms = [];
  assert.ok(
    renderToStaticMarkup(React.createElement(GovernancePanel, props)).includes(
      "En az iki sakin",
    ),
  );
  const { StaffPanel } = await vite.ssrLoadModule(
    "/src/components/StaffPanel.tsx",
  );
  const staff = renderToStaticMarkup(
    React.createElement(StaffPanel, {
      identity: {
        roles: [
          {
            code: "editor",
            title: "Editör",
            scope_kind: "building",
            scope_id: "fixture",
          },
        ],
        permissions: [],
        scoped_permissions: [],
      },
    }),
  );
  assert.ok(staff.includes("Editör"));
  assert.ok(staff.includes("MFA hazırla"));
  assert.ok(!staff.includes("Kullanıcıya yetki ver"));
  const { PanelGroup } = await vite.ssrLoadModule("/src/components/PanelGroup.tsx");
  const group = renderToStaticMarkup(React.createElement(PanelGroup, {
    title: "Oyuncular ve ekonomi",
    description: "Bakiye ve kasa işlemleri",
    children: React.createElement("form", null,
      React.createElement("label", null, "İşlem gerekçesi",
        React.createElement("textarea", { required: true, defaultValue: "Kontrol için açıklama" }))),
  }));
  assert.match(group, /<details class="panel-group"><summary>/);
  assert.match(group, /Oyuncular ve ekonomi/);
  assert.match(group, /<textarea required="">Kontrol için açıklama<\/textarea>/,
    "Closed disclosures keep forms in the document rather than unmounting them");
  assert.doesNotMatch(group, /open=""/);
  assert.ok(staff.includes("Hesap güvenliği"));
  assert.ok(staff.includes("Yönetim merkezi"));

  const { StaffMfa } = await vite.ssrLoadModule("/src/components/StaffMfa.tsx");
  const security = renderToStaticMarkup(React.createElement(StaffMfa));
  assert.ok(security.includes("MFA hazırla / doğrula"));
  assert.ok(security.includes("tek başına yönetici yetkisi vermez"));
  assert.ok(!security.includes("AAL2"));

  const { PollCard } = await vite.ssrLoadModule("/src/components/PollCard.tsx");
  const pollProps = {
    poll: { id: "poll", ends_at: iso(now + 3600000), status: "open", yes_count: 1, no_count: 0, minimum_votes: 3 },
    event: { title: "Asansör arızası", description: "Birlikte karar veriyoruz.", cost: 1200 },
    busy: false, onVote: () => {},
  };
  const openPoll = renderToStaticMarkup(React.createElement(PollCard, pollProps));
  assert.ok(openPoll.includes(">Onayla</button>"));
  assert.ok(openPoll.includes(">Reddet</button>"));
  const votedPoll = renderToStaticMarkup(React.createElement(PollCard, {
    ...pollProps, vote: { choice: true },
  }));
  assert.ok(!votedPoll.includes(">Onayla</button>"));
  assert.ok(votedPoll.includes("Bir kez oy kullanabilirsiniz"));

  const insufficient = structuredClone(data);
  insufficient.wallets[0].balance = 100;
  insufficient.dues = [{ id: "due", week_start: "2026-11-16", amount: 150, paid_at: null }];
  const dueMarkup = renderToStaticMarkup(React.createElement(EconomyPanel, { ...props, data: insufficient }));
  assert.match(dueMarkup, /<button disabled="">Bakiye yetersiz<\/button>/);
  insufficient.dues[0].paid_at = iso(now);
  const paidMarkup = renderToStaticMarkup(React.createElement(EconomyPanel, { ...props, data: insufficient }));
  assert.ok(paidMarkup.includes("Ödendi"));
  assert.ok(!paidMarkup.includes("Bakiye yetersiz"));

  const { ManagementSummary } = await vite.ssrLoadModule("/src/components/GovernancePanel.tsx");
  const summary = renderToStaticMarkup(React.createElement(ManagementSummary, props));
  assert.match(summary, /<dl class="finance-summary" aria-label="Bu haftanın kasa özeti">/);
  assert.ok(summary.includes("Haftalık gelir") && summary.includes("Haftalık gider"));
  const { uiText } = await vite.ssrLoadModule("/src/uiText.ts");
  assert.equal(uiText("wallet.adjust"), "Kişisel bakiye düzeltildi");
  assert.equal(uiText("future.module"), "future.module", "Unknown audit codes remain traceable");
  assert.equal(uiText("toString"), "toString");
  const { AppShell } = await vite.ssrLoadModule('/src/components/AppShell.tsx');
  const { SectionNav } = await vite.ssrLoadModule('/src/components/SectionNav.tsx');
  const shellProps = { route: { page:'today' }, access:{authenticated:true,resident:true,staff:false},name:'Ayşe',building:'Çınar Apartmanı',live:'Bağlanıyor',busy:false,theme:'system',onTheme:()=>{},onSignOut:()=>{},children:React.createElement('h1',null,'İçerik') };
  const shell = renderToStaticMarkup(React.createElement(AppShell,shellProps));
  for (const label of ['Bugün','Dairem','Apartman','Komşular','Profilim','Ayarlar','Hesap güvenliği']) assert.ok(shell.includes(label),label);
  assert.ok(!shell.includes('Sistem Yönetim Merkezi'));
  assert.equal((shell.match(/class="navigation-icon"/g)||[]).length,4);
  assert.equal((shell.match(/aria-hidden="true" focusable="false"/g)||[]).length,9);
  assert.ok(renderToStaticMarkup(React.createElement(AppShell,{...shellProps,access:{authenticated:true,resident:false,staff:true}})).includes('Sistem Yönetim Merkezi'));
  const managerNav = renderToStaticMarkup(React.createElement(SectionNav,{route:{page:'building'},manager:true}));
  const residentNav = renderToStaticMarkup(React.createElement(SectionNav,{route:{page:'building'},manager:false}));
  assert.ok(managerNav.includes('Yönetici Masası'));
  assert.ok(!residentNav.includes('Yönetici Masası'));
  const { TodayScreen, HomeScene, BuildingScene, EmptyIllustration } = await vite.ssrLoadModule('/src/components/PlayerScenes.tsx');
  const sceneData = { ...data, profiles:[],memberships:[{user_id:'a'}],apartments:Array.from({length:12},(_,i)=>({id:String(i),number:i+1})),buildings:[{name:'Çınar Apartmanı',treasury:3800}],polls:[],events:[],votes:[],activity:[],announcements:[] };
  const today = renderToStaticMarkup(React.createElement(TodayScreen,{data:sceneData,userId:'a',name:'Ayşe'}));
  assert.ok(today.includes('300 OP'));
  assert.ok(today.includes('Bugün maaş kaydı yok'));
  assert.ok(today.includes('Aidatta için rahat'));
  assert.ok(today.includes('href="#/dairem/isler/ek-is"'));
  assert.ok(!today.includes('Birlikte karar veriyoruz'), 'No empty decision card');
  assert.ok(!today.includes('Maaşını al'));
  const { trDay } = await vite.ssrLoadModule('/src/economy.ts');
  const completed = structuredClone(sceneData);
  completed.wallet_transactions.push({kind:'side_job',period_key:trDay(),amount:25,created_at:iso(now)});
  const doneToday = renderToStaticMarkup(React.createElement(TodayScreen,{data:completed,userId:'a',name:'Ayşe'}));
  assert.ok(doneToday.includes('Bugünün işi tamam'));
  assert.ok(!doneToday.includes('href="#/dairem/isler/ek-is"'), 'Completed job has no active repeat shortcut');
  completed.wallets[0].job=null;
  completed.wallet_transactions=[];
  assert.ok(renderToStaticMarkup(React.createElement(TodayScreen,{data:completed,userId:'a',name:'Ayşe'})).includes('Meslek seç'));
  const room = renderToStaticMarkup(React.createElement(HomeScene,{name:'Ayşe',number:1,building:'Çınar Apartmanı'}));
  assert.match(room,/src="\/apartman-online\/art\/v2\/apartment-interior.svg"/);
  const facade = renderToStaticMarkup(React.createElement(BuildingScene,{data:sceneData,username:()=> 'Ayşe',units:Array.from({length:12},(_,i)=>({number:i+1,status:'empty'})),viewerId:'a',onResident:()=>{}}));
  assert.ok(facade.includes('apartment-facade.svg') && facade.includes('Etkileşimli apartman'));
  assert.equal((facade.match(/class="facade-door/g)||[]).length,12,'All twelve real apartment targets');
  assert.ok(facade.includes('Apartman girişi · Kasa ve Pano'));
  for (const kind of ['chat','mail','vote']) assert.ok(renderToStaticMarkup(React.createElement(EmptyIllustration,{kind,title:'Boş durum'})).includes('empty-'+kind+'.svg'));
  const catalog = await vite.ssrLoadModule('virtual:apartman-art-catalog');
  const { readFileSync } = await import('node:fs');
  assert.deepEqual(catalog.anchors,JSON.parse(readFileSync('public/art/v2/apartment-anchors.json')));
  assert.deepEqual(catalog.avatars,JSON.parse(readFileSync('public/art/v2/avatars/manifest.json')));
  const { Avatar } = await vite.ssrLoadModule('/src/components/Avatar.tsx');
  const { ResidentFullProfile } = await vite.ssrLoadModule('/src/components/ResidentProfiles.tsx');
  const { publicApartments } = await vite.ssrLoadModule('/src/social.ts');
  const publicInfo=publicApartments('a',{id:'b',name:'Çınar Apartmanı'},[{id:'a',username:'Ayşe',email:'NEVER_SHOW',balance:7654321}], [{user_id:'a',building_id:'b',apartment_id:'apt',joined_at:'2026-11-01'}], [{id:'apt',building_id:'b',number:1}],[])[0].resident;
  const social=renderToStaticMarkup(React.createElement(ResidentFullProfile,{resident:publicInfo,own:true,blocked:false,busy:false,back:'#/komsular/sakinler',onBlock:()=>{}}));
  assert.ok(social.includes('/apartman-online/art/v2/avatars/portrait-'));
  assert.ok(social.includes('Kasım 2026') && social.includes('Daireme Git'));
  assert.doesNotMatch(social,/NEVER_SHOW|7654321|staff_roles|MFA/);
  assert.ok(renderToStaticMarkup(React.createElement(Avatar,{userId:'../invalid',name:'Ayşe'})).includes('aria-label="Ayşe avatarı"'));
  assert.ok(renderToStaticMarkup(React.createElement(ResidentFullProfile,{own:false,blocked:false,busy:false,back:'#/komsular/sakinler',onBlock:()=>{}})).includes('Bu profile erişilemiyor'));
  const { SettingsScreen } = await vite.ssrLoadModule('/src/components/AccountScreens.tsx');
  const { appearanceDefaults } = await vite.ssrLoadModule('/src/appearance.ts');
  const settingsProps={theme:'system',onTheme:()=>{},appearance:appearanceDefaults,onAppearance:()=>{},canPersist:true,view:'gorunum',blocked:[],resident:true,loading:false,busy:false,onUnblock:()=>{}};
  const appearanceMarkup=renderToStaticMarkup(React.createElement(SettingsScreen,settingsProps));
  for(const text of ['Yazı boyutu','Ekran yoğunluğu','Hareketi azalt','Görünüm tercihlerini sıfırla','Hesap güvenliği']) assert.ok(appearanceMarkup.includes(text));
  assert.ok(!appearanceMarkup.includes('type="password"') && !appearanceMarkup.includes('avatar_id'));
  const privacyMarkup=renderToStaticMarkup(React.createElement(SettingsScreen,{...settingsProps,view:'gizlilik',blocked:[{userId:'a',resident:publicInfo},{userId:'former'}]}));
  assert.ok(privacyMarkup.includes('Bilgisine erişilemeyen komşu') && privacyMarkup.includes('Engeli kaldır'));
  assert.ok(privacyMarkup.includes('karşılıklı profil erişimini engellemez'));
  assert.doesNotMatch(privacyMarkup,/NEVER_SHOW|7654321/);
  assert.ok(renderToStaticMarkup(React.createElement(SettingsScreen,{...settingsProps,canPersist:false})).includes('Tarayıcı saklamaya izin vermiyor'));
  assert.ok(renderToStaticMarkup(React.createElement(SettingsScreen,{...settingsProps,view:'gizlilik',loading:true})).includes('Komşu bilgileri yükleniyor'));
  console.log(
    "PASS static React: wallet/job/dues/payment states, election permissions, poll voting, native disclosures, account security, semantic financial summary and audit labels. Browser/mobile/Realtime NOT tested.",
  );
} finally {
  await vite.close();
}
