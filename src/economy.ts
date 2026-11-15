export interface Wallet {
  user_id: string;
  balance: number;
  job: Job | null;
  job_changed_at: string | null;
  employment_started_on: string | null;
  side_job_started_at: string | null;
}
export type Job = "office" | "shop" | "technical";
export interface WalletTransaction {
  id: string;
  amount: number;
  balance_after: number;
  kind: string;
  period_key: string;
  description: string;
  created_at: string;
}
export interface Due {
  id: string;
  user_id: string;
  week_start: string;
  amount: number;
  paid_at: string | null;
}
export interface Expense {
  id: string;
  week_start: string;
  kind: string;
  amount: number;
  active_residents: number;
  paid_at: string | null;
}
export interface Settings {
  building_id: string;
  first_week: string;
  daily_salary: number;
  side_job_reward: number;
  weekly_dues: number;
  cleaning_base: number;
  cleaning_per_resident: number;
  maintenance_base: number;
  maintenance_per_resident: number;
}
export interface TreasuryEntry {
  id: string;
  amount: number;
  kind: string;
  description: string;
  created_at: string;
}
export interface Election {
  id: string;
  starts_at: string;
  nominations_end: string;
  voting_end: string;
  status: "nominations" | "voting" | "elected" | "failed";
  electorate_size: number;
  quorum: number;
  winner_id: string | null;
  result_reason: string | null;
  retry_after: string | null;
}
export interface Candidate {
  election_id: string;
  user_id: string;
  statement: string;
}
export interface ElectionVote {
  election_id: string;
  user_id: string;
  candidate_id: string;
}
export interface Elector {
  election_id: string;
  user_id: string;
}
export interface Term {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
}
export interface Rate {
  id: string;
  effective_week: string;
  amount: number;
}
export interface CatalogItem {
  kind: string;
  title: string;
  cost: number;
}
export interface DuesOverview {
  week_start: string;
  assessed_count: number;
  paid_count: number;
  assessed_amount: number;
  paid_amount: number;
  unpaid_amount: number;
}
export interface EconomyData {
  dues_overview: DuesOverview[];
  wallets: Wallet[];
  wallet_transactions: WalletTransaction[];
  dues: Due[];
  operating_expenses: Expense[];
  economy_settings: Settings[];
  treasury_history: TreasuryEntry[];
  elections: Election[];
  election_candidates: Candidate[];
  election_votes: ElectionVote[];
  election_electorate: Elector[];
  manager_terms: Term[];
  dues_rates: Rate[];
  expense_catalog: CatalogItem[];
}
export const economyTables: (keyof EconomyData)[] = [
  "dues_overview",
  "wallets",
  "wallet_transactions",
  "dues",
  "operating_expenses",
  "economy_settings",
  "treasury_history",
  "elections",
  "election_candidates",
  "election_votes",
  "election_electorate",
  "manager_terms",
  "dues_rates",
  "expense_catalog",
];
export const jobs: Record<
  Job,
  { title: string; task: string; instruction: string }
> = {
  office: {
    title: "Ofis çalışanı",
    task: "Fazladan evrak işi",
    instruction: "Evrakları tarih sırasına koy ve dosyalamayı tamamla.",
  },
  shop: {
    title: "Esnaf",
    task: "Ek sipariş hazırlama",
    instruction: "Sipariş listesini kontrol et ve paketi teslimata hazırla.",
  },
  technical: {
    title: "Teknik personel",
    task: "Küçük tamirat işi",
    instruction: "Arızayı kontrol et ve küçük onarımı tamamla.",
  },
};
export const trDay = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function trWeek() {
  const date = new Date(trDay() + "T12:00:00+03:00");
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return trDay(date);
}
export function currentTerm(terms: Term[]) {
  const now = Date.now();
  return terms.find(
    (t) => Date.parse(t.starts_at) <= now && Date.parse(t.ends_at) > now,
  );
}
export type Perform = (
  rpc: string,
  args: Record<string, unknown>,
  success: string,
) => void;
