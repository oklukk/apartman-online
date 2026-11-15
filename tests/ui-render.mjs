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
  console.log(
    "PASS static React: wallet/job/dues, candidacy, manager-only controls and empty states. Browser/mobile/Realtime NOT tested.",
  );
} finally {
  await vite.close();
}
