/**
 * Shared engine for the Personal Finance analyzers. A bank statement is parsed
 * once into a list of typed transactions, then every analyzer is a thin view
 * over the same list: cash flow by month, spending by merchant, recurring
 * charges, and so on.
 *
 * Unlike the passthrough CSV tools (where the golden rule is "never coerce
 * types"), analyzers must turn amounts into numbers to add them up. Correctness
 * therefore rests on the SAME safeguard as the OFX tool: the date format and
 * decimal separator are chosen explicitly by the user, never guessed. Rows we
 * cannot parse are reported, not silently dropped or defaulted.
 */

import { parseDateToYmd, parseAmount, type DateFormat } from './ofx';

export type { DateFormat };

export type Txn = {
  /** YYYYMMDD, from parseDateToYmd */
  ymd: string;
  /** YYYY-MM-DD, display/ISO */
  date: string;
  /** YYYY-MM, for monthly grouping */
  month: string;
  /** signed: negative = money out, positive = money in */
  amount: number;
  /** original description text, untouched */
  description: string;
  /** best-effort normalized merchant label derived from description */
  merchant: string;
};

export type AmountMode = 'single' | 'split';

export type StatementMap = {
  amountMode: AmountMode;
  date: number;
  /** used when amountMode === 'single' */
  amount: number;
  /** used when amountMode === 'split' */
  debit: number;
  credit: number;
  description: number;
  /** when true, a positive number in the single amount column means money OUT */
  debitsArePositive: boolean;
};

export const DEFAULT_MAP: StatementMap = {
  amountMode: 'single',
  date: -1,
  amount: -1,
  debit: -1,
  credit: -1,
  description: -1,
  debitsArePositive: false,
};

export type BuildResult = {
  txns: Txn[];
  skipped: { row: number; reason: string }[];
};

function ymdToIso(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

/**
 * Turn mapped rows into typed transactions. A row is skipped (and reported)
 * when its date or amount cannot be read — never guessed.
 */
export function buildTransactions(
  rows: string[][],
  map: StatementMap,
  dateFormat: DateFormat,
  decimal: '.' | ',',
): BuildResult {
  const txns: Txn[] = [];
  const skipped: { row: number; reason: string }[] = [];

  rows.forEach((row, i) => {
    const rawDate = map.date >= 0 ? row[map.date] ?? '' : '';
    const ymd = parseDateToYmd(rawDate, dateFormat);
    if (ymd === null) {
      skipped.push({ row: i + 1, reason: `could not read the date "${rawDate}"` });
      return;
    }

    let amount: number | null = null;
    if (map.amountMode === 'split') {
      const rawDebit = map.debit >= 0 ? (row[map.debit] ?? '').trim() : '';
      const rawCredit = map.credit >= 0 ? (row[map.credit] ?? '').trim() : '';
      const debit = rawDebit ? parseAmount(rawDebit, decimal) : 0;
      const credit = rawCredit ? parseAmount(rawCredit, decimal) : 0;
      if (debit === null || credit === null) {
        skipped.push({ row: i + 1, reason: `could not read the debit/credit amount` });
        return;
      }
      // credit is money in (+), debit is money out (-)
      amount = Math.abs(credit) - Math.abs(debit);
    } else {
      const rawAmt = map.amount >= 0 ? row[map.amount] ?? '' : '';
      const parsed = parseAmount(rawAmt, decimal);
      if (parsed === null) {
        skipped.push({ row: i + 1, reason: `could not read the amount "${rawAmt}"` });
        return;
      }
      amount = map.debitsArePositive ? -parsed : parsed;
    }

    const description = (map.description >= 0 ? row[map.description] ?? '' : '').trim();
    txns.push({
      ymd,
      date: ymdToIso(ymd),
      month: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}`,
      amount,
      description,
      merchant: normalizeMerchant(description),
    });
  });

  return { txns, skipped };
}

// Payment-processor and channel prefixes that sit in front of the real merchant
// name. Stripped conservatively so variants of one merchant group together.
// Pure payment channel / processor prefixes only — NOT real brand names like
// Amazon or Google, which are the merchant we want to keep. Processors that
// prefix a real name with "*" (PAYPAL *SPOTIFY, SQ *CAFE) are handled by the
// "*" rule below, so they don't all need listing here.
const PREFIXES = [
  'pos', 'purchase', 'payment', 'card payment', 'visa', 'mastercard', 'debit card',
  'contactless', 'chip and pin', 'online', 'recurring', 'direct debit', 'dd',
  'sepa', 'transfer to', 'transfer from', 'bill payment to', 'payment to', 'payment from',
  'paypal', 'sumup',
];

/**
 * Best-effort merchant label from a raw bank description. Conservative on
 * purpose: it strips reference numbers, card masks, dates and known payment
 * prefixes, then title-cases what is left. It groups variants of the same
 * merchant without being so aggressive that it merges different ones.
 */
export function normalizeMerchant(raw: string): string {
  let s = (raw || '').trim();
  if (!s) return 'Unknown';

  s = s.toLowerCase();
  // Strip a leading processor marker like "paypal *", "sq *", "amzn mktp*"
  s = s.replace(/^([a-z]{2,10})\s*\*\s*/i, '');
  // Remove card masks (**** 1234), long digit runs, and reference tokens
  s = s.replace(/\*+\s*\d+/g, ' ');
  s = s.replace(/\bx{2,}\d+/gi, ' ');
  s = s.replace(/\b\d[\d\/.:-]{3,}\b/g, ' '); // dates, ref numbers
  s = s.replace(/\b\d{4,}\b/g, ' '); // long numbers
  // Drop leading channel prefixes, possibly several
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of PREFIXES) {
      const re = new RegExp(`^${p}\\b[\\s:*-]*`, 'i');
      if (re.test(s)) { s = s.replace(re, ''); changed = true; }
    }
  }
  // Collapse leftover punctuation and whitespace
  s = s.replace(/[^a-z0-9&' ]+/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return titleCase((raw.trim() || 'unknown').toLowerCase());

  // Keep the first few meaningful words — merchant names are usually short
  const words = s.split(' ').filter((w) => w.length > 1 || /\d/.test(w));
  const kept = (words.length ? words : s.split(' ')).slice(0, 4).join(' ');
  return titleCase(kept);
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type Totals = {
  moneyIn: number;
  moneyOut: number;
  net: number;
  count: number;
  from: string;
  to: string;
};

export function totals(txns: Txn[]): Totals {
  let moneyIn = 0;
  let moneyOut = 0;
  let from = '';
  let to = '';
  for (const t of txns) {
    if (t.amount >= 0) moneyIn += t.amount;
    else moneyOut += -t.amount;
    if (!from || t.ymd < from) from = t.ymd;
    if (!to || t.ymd > to) to = t.ymd;
  }
  return {
    moneyIn: round2(moneyIn),
    moneyOut: round2(moneyOut),
    net: round2(moneyIn - moneyOut),
    count: txns.length,
    from: from ? ymdToIso(from) : '',
    to: to ? ymdToIso(to) : '',
  };
}

export type MonthFlow = { month: string; in: number; out: number; net: number; count: number };

/** Money in vs money out, grouped by calendar month, chronological. */
export function cashFlowByMonth(txns: Txn[]): MonthFlow[] {
  const map = new Map<string, MonthFlow>();
  for (const t of txns) {
    let row = map.get(t.month);
    if (!row) { row = { month: t.month, in: 0, out: 0, net: 0, count: 0 }; map.set(t.month, row); }
    if (t.amount >= 0) row.in += t.amount;
    else row.out += -t.amount;
    row.count++;
  }
  return [...map.values()]
    .map((r) => ({ ...r, in: round2(r.in), out: round2(r.out), net: round2(r.in - r.out) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Whole-day gap between two YYYYMMDD dates. */
export function daysBetween(a: string, b: string): number {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  return Math.round((d(b) - d(a)) / 86400000);
}

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

const CADENCE_WINDOWS: { cadence: Cadence; min: number; max: number; perYear: number }[] = [
  { cadence: 'weekly', min: 6, max: 8, perYear: 52 },
  { cadence: 'biweekly', min: 12, max: 16, perYear: 26 },
  { cadence: 'monthly', min: 27, max: 32, perYear: 12 },
  { cadence: 'quarterly', min: 85, max: 95, perYear: 4 },
  { cadence: 'yearly', min: 350, max: 380, perYear: 1 },
];

function classifyGap(gap: number): Cadence | null {
  for (const w of CADENCE_WINDOWS) if (gap >= w.min && gap <= w.max) return w.cadence;
  return null;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type Recurring = {
  merchant: string;
  /** typical (median) absolute amount per charge */
  amount: number;
  cadence: Cadence;
  count: number;
  first: string; // ISO
  last: string; // ISO
  /** normalized cost per month, for ranking and totals */
  monthlyCost: number;
  /** true when backed by 3+ charges (2 charges = a guess) */
  confident: boolean;
};

/**
 * Detect recurring charges: transactions to the same merchant, at a stable
 * amount, spaced at a regular cadence. Conservative by design — a wrong "you
 * have a subscription" is annoying, so it needs a consistent gap and a stable
 * amount, and flags 2-charge matches as unconfirmed.
 *
 * direction 'out' (default) finds subscriptions/bills; 'in' finds recurring
 * income like salary.
 */
export function detectRecurring(txns: Txn[], direction: 'out' | 'in' = 'out'): Recurring[] {
  const pool = txns.filter((t) => (direction === 'out' ? t.amount < 0 : t.amount > 0));

  // Group by merchant, then split each merchant into amount clusters.
  const byMerch = new Map<string, Txn[]>();
  for (const t of pool) {
    const arr = byMerch.get(t.merchant) ?? [];
    arr.push(t);
    byMerch.set(t.merchant, arr);
  }

  const out: Recurring[] = [];
  for (const [merchant, list] of byMerch) {
    list.sort((a, b) => a.ymd.localeCompare(b.ymd));

    // Cluster by absolute amount (tolerance: 2% or 1 unit, whichever larger).
    const clusters: Txn[][] = [];
    for (const t of list) {
      const amt = Math.abs(t.amount);
      let placed = false;
      for (const c of clusters) {
        const ref = Math.abs(c[0].amount);
        if (Math.abs(amt - ref) <= Math.max(1, ref * 0.02)) { c.push(t); placed = true; break; }
      }
      if (!placed) clusters.push([t]);
    }

    for (const c of clusters) {
      if (c.length < 2) continue;
      const gaps: number[] = [];
      for (let i = 1; i < c.length; i++) gaps.push(daysBetween(c[i - 1].ymd, c[i].ymd));
      // Every gap must fall in the SAME cadence window.
      const cadences = gaps.map(classifyGap);
      const cadence = cadences[0];
      if (!cadence || cadences.some((x) => x !== cadence)) continue;

      const amt = round2(median(c.map((t) => Math.abs(t.amount))));
      const perYear = CADENCE_WINDOWS.find((w) => w.cadence === cadence)!.perYear;
      out.push({
        merchant,
        amount: amt,
        cadence,
        count: c.length,
        first: c[0].date,
        last: c[c.length - 1].date,
        monthlyCost: round2((amt * perYear) / 12),
        confident: c.length >= 3,
      });
    }
  }

  return out.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

export type DuplicateGroup = {
  merchant: string;
  amount: number; // signed, the shared value
  count: number;
  dates: string[]; // ISO, chronological
  /** largest gap in days within the cluster — small = more suspicious */
  spanDays: number;
};

/**
 * Find likely double charges: two or more transactions to the same merchant,
 * for the same amount, within `windowDays` of each other. This is a suspicion
 * (a genuine daily coffee at the same price would match too), so it is scoped
 * tightly and always presented for the user to judge — never auto-removed.
 */
export function findDuplicateCharges(txns: Txn[], windowDays = 3): DuplicateGroup[] {
  // Key by merchant + exact rounded amount (sign included).
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    const key = `${t.merchant}|${round2(t.amount).toFixed(2)}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const out: DuplicateGroup[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.ymd.localeCompare(b.ymd));
    // Chain consecutive transactions that are within the window into clusters.
    let cluster: Txn[] = [list[0]];
    const flush = () => {
      if (cluster.length >= 2) {
        out.push({
          merchant: cluster[0].merchant,
          amount: round2(cluster[0].amount),
          count: cluster.length,
          dates: cluster.map((t) => t.date),
          spanDays: daysBetween(cluster[0].ymd, cluster[cluster.length - 1].ymd),
        });
      }
      cluster = [];
    };
    for (let i = 1; i < list.length; i++) {
      if (daysBetween(list[i - 1].ymd, list[i].ymd) <= windowDays) cluster.push(list[i]);
      else { flush(); cluster = [list[i]]; }
    }
    flush();
  }

  // Most suspicious first: more copies, then tighter span, then larger amount.
  return out.sort(
    (a, b) => b.count - a.count || a.spanDays - b.spanDays || Math.abs(b.amount) - Math.abs(a.amount),
  );
}

/**
 * Keyword-based category rules. First matching rule wins, so more specific
 * brands sit above generic words. This is intentionally simple and transparent
 * (the list is exported) — it is a best-effort starting point, not an
 * authoritative classification. Real-world descriptions are messy; expect to
 * correct some. Matching is done on the lowercased raw description.
 */
export type CategoryRule = { category: string; keywords: string[] };

export const CATEGORY_RULES: CategoryRule[] = [
  { category: 'Software & subscriptions', keywords: ['spotify', 'netflix', 'disney', 'hbo', 'adobe', 'github', 'notion', 'openai', 'chatgpt', 'dropbox', 'icloud', 'youtube premium', 'microsoft', 'office 365', 'apple.com/bill', 'audible', 'patreon', 'subscription'] },
  { category: 'Fuel', keywords: ['shell', 'bp ', 'exxon', 'chevron', 'esso', 'texaco', 'petrol', 'fuel', 'gas station', 'omv', 'petrom', 'mol '] },
  { category: 'Transport', keywords: ['uber', 'lyft', 'bolt', 'taxi', 'tfl', 'transit', 'metro', 'railway', 'train', ' rail', 'trainline', 'parking', 'toll', 'mta', 'transport'] },
  { category: 'Groceries', keywords: ['tesco', 'sainsbury', 'aldi', 'lidl', 'kroger', 'walmart', 'whole foods', 'carrefour', 'mega image', 'kaufland', 'grocery', 'supermarket', 'safeway', 'costco', 'trader joe'] },
  { category: 'Dining & takeaway', keywords: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'kfc', 'burger', 'pizza', 'uber eats', 'ubereats', 'deliveroo', 'just eat', 'doordash', 'grubhub', 'bistro', 'diner', 'takeaway', 'pub ', 'costa'] },
  { category: 'Travel', keywords: ['hotel', 'airbnb', 'booking.com', 'expedia', 'ryanair', 'easyjet', 'airline', 'airways', 'flight', 'wizz air', 'hostel'] },
  { category: 'Health & fitness', keywords: ['pharmacy', 'chemist', 'doctor', 'dental', 'dentist', 'clinic', 'hospital', 'gym', 'fitness', 'boots', 'cvs', 'walgreens', 'health'] },
  { category: 'Entertainment', keywords: ['cinema', 'movie', 'theatre', 'theater', 'steam', 'playstation', 'xbox', 'nintendo', 'concert', 'ticketmaster', 'event'] },
  { category: 'Utilities & telecom', keywords: ['electric', 'energy', 'water bill', 'utility', 'broadband', 'internet', 'vodafone', 'verizon', 'at&t', 'comcast', 'o2 ', 'ee ', 'three ', 'orange', 'telekom', 'mobile', 'wireless'] },
  { category: 'Rent & housing', keywords: ['rent', 'mortgage', 'landlord', 'letting', 'housing', 'property'] },
  { category: 'Cash & ATM', keywords: ['atm', 'cash withdrawal', 'cashpoint', 'withdrawal', 'cash machine'] },
  { category: 'Fees & interest', keywords: ['overdraft', 'interest charge', 'service fee', 'monthly fee', 'commission', 'bank charge', 'atm fee', 'foreign exchange fee', 'non-sterling'] },
  { category: 'Transfers', keywords: ['transfer', 'zelle', 'venmo', 'standing order', 'faster payment', 'wise', 'revolut', 'sepa', 'sent to', 'received from'] },
  { category: 'Shopping', keywords: ['amazon', 'ebay', 'etsy', 'ikea', 'target', 'zara', 'h&m', 'nike', 'aliexpress', 'asos', 'store', 'shop'] },
  { category: 'Income', keywords: ['salary', 'payroll', 'wages', 'dividend', 'refund', 'interest earned'] },
];

/** Best-effort category for one transaction. First matching rule wins. */
export function categorize(t: Txn): string {
  const hay = (t.description || t.merchant || '').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => hay.includes(k))) return rule.category;
  }
  return 'Uncategorized';
}

export type CategoryRow = { category: string; total: number; count: number };

/** Spending (or income) grouped by best-effort category, largest first. */
export function byCategory(txns: Txn[], direction: 'out' | 'in' = 'out'): CategoryRow[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    if (direction === 'out' && t.amount >= 0) continue;
    if (direction === 'in' && t.amount < 0) continue;
    const cat = categorize(t);
    const row = map.get(cat) ?? { total: 0, count: 0 };
    row.total += Math.abs(t.amount);
    row.count++;
    map.set(cat, row);
  }
  return [...map.entries()]
    .map(([category, r]) => ({ category, total: round2(r.total), count: r.count }))
    .sort((a, b) => b.total - a.total);
}

export type MerchantRow = { merchant: string; total: number; count: number };

/**
 * Group by normalized merchant. direction 'out' sums spending (money out),
 * 'in' sums income, 'all' sums the signed net.
 */
export function byMerchant(txns: Txn[], direction: 'out' | 'in' | 'all' = 'out'): MerchantRow[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    if (direction === 'out' && t.amount >= 0) continue;
    if (direction === 'in' && t.amount < 0) continue;
    const value = direction === 'out' ? -t.amount : direction === 'in' ? t.amount : t.amount;
    let row = map.get(t.merchant);
    if (!row) { row = { total: 0, count: 0 }; map.set(t.merchant, row); }
    row.total += value;
    row.count++;
  }
  return [...map.entries()]
    .map(([merchant, r]) => ({ merchant, total: round2(r.total), count: r.count }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}
