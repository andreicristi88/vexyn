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
const PREFIXES = [
  'pos', 'purchase', 'payment', 'card payment', 'visa', 'mastercard', 'debit card',
  'contactless', 'chip and pin', 'online', 'recurring', 'direct debit', 'dd',
  'sepa', 'transfer to', 'transfer from', 'bill payment to', 'payment to', 'payment from',
  'paypal', 'sq', 'tst', 'amzn mktp', 'amzn', 'amazon', 'google', 'apple pay', 'sumup',
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
  if (!s) return raw.trim() || 'Unknown';

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
