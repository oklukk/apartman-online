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
  console.log(
    "PASS static React: wallet/job/dues/payment states, election permissions, poll voting, native disclosures, account security, semantic financial summary and audit labels. Browser/mobile/Realtime NOT tested.",
  );
} finally {
  await vite.close();
}
