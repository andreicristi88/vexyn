/**
 * Stripe-export helpers. Stripe's CSVs are wide and cryptic (the payments
 * export runs to 80+ columns), so these recognise the columns by their exact
 * Stripe header names and reduce a raw export to the handful of fields a human
 * — or an accountant — actually needs, with the one derived number that the
 * export leaves you to work out yourself: net.
 *
 * Amounts in Stripe exports are dot-decimal major units ("100.00"), dates are
 * "YYYY-MM-DD HH:MM:SS" UTC. Nothing is guessed: a column that is not present
 * is simply absent, and unparseable money is treated as zero for the sum but
 * the row is kept.
 */

import { parseAmount } from './ofx';
import type { Grid } from './csv';

function findCol(headers: string[], name: string): number {
  const n = name.toLowerCase().trim();
  return headers.findIndex((h) => h.toLowerCase().trim() === n);
}

/** First header (by index) that matches any of the candidate names. */
function findColAny(headers: string[], names: string[]): number {
  for (const name of names) {
    const i = findCol(headers, name);
    if (i >= 0) return i;
  }
  return -1;
}

/** True when the grid looks like a Stripe payments (unified_payments) export. */
export function isStripePayments(headers: string[]): boolean {
  const has = (n: string) => findCol(headers, n) >= 0;
  return has('id') && has('Amount') && has('Currency') && (has('Created date (UTC)') || has('Created (UTC)')) && (has('Fee') || has('Status'));
}

export type StripePayment = {
  id: string;
  date: string; // ISO YYYY-MM-DD (or '' if unreadable)
  description: string;
  email: string;
  currency: string;
  status: string;
  amount: number;
  fee: number;
  refunded: number;
  net: number; // amount - fee - refunded
};

export type StripeCleanResult = {
  rows: StripePayment[];
  totals: { gross: number; fees: number; refunds: number; net: number; count: number; currency: string };
};

function money(v: string | undefined, decimal: '.' | ','): number {
  if (!v || !v.trim()) return 0;
  const n = parseAmount(v, decimal);
  return n === null ? 0 : n;
}

function isoDate(v: string | undefined): string {
  if (!v) return '';
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Reduce a Stripe payments export to clean rows plus a net column, and total
 * gross / fees / refunds / net. `decimal` covers the rare re-saved-in-Excel
 * European file; Stripe's own export is always dot-decimal.
 */
export function cleanStripePayments(grid: Grid, decimal: '.' | ',' = '.'): StripeCleanResult {
  const h = grid.headers;
  const cId = findCol(h, 'id');
  const cDate = findCol(h, 'Created date (UTC)') >= 0 ? findCol(h, 'Created date (UTC)') : findCol(h, 'Created (UTC)');
  const cAmount = findCol(h, 'Amount');
  const cRefunded = findCol(h, 'Amount Refunded');
  const cCurrency = findCol(h, 'Currency');
  const cFee = findCol(h, 'Fee');
  const cDesc = findCol(h, 'Description');
  const cStatus = findCol(h, 'Status');
  const cEmail = findCol(h, 'Customer Email');

  const rows: StripePayment[] = [];
  let gross = 0, fees = 0, refunds = 0, net = 0;
  let currency = '';

  for (const r of grid.rows) {
    const amount = money(r[cAmount], decimal);
    const fee = money(r[cFee], decimal);
    const refunded = money(r[cRefunded], decimal);
    const rowNet = round2(amount - fee - refunded);
    const cur = (cCurrency >= 0 ? r[cCurrency] ?? '' : '').trim().toUpperCase();
    if (cur && !currency) currency = cur;
    gross += amount; fees += fee; refunds += refunded; net += rowNet;
    rows.push({
      id: cId >= 0 ? (r[cId] ?? '').trim() : '',
      date: isoDate(cDate >= 0 ? r[cDate] : ''),
      description: cDesc >= 0 ? (r[cDesc] ?? '').trim() : '',
      email: cEmail >= 0 ? (r[cEmail] ?? '').trim() : '',
      currency: cur,
      status: cStatus >= 0 ? (r[cStatus] ?? '').trim() : '',
      amount, fee, refunded, net: rowNet,
    });
  }

  return {
    rows,
    totals: { gross: round2(gross), fees: round2(fees), refunds: round2(refunds), net: round2(net), count: rows.length, currency },
  };
}

// --- Payouts export --------------------------------------------------------
// Built to Stripe's documented Payouts export columns, with flexible header
// matching so a real export slots in. VALIDATE against a real file — column
// names have drifted across Stripe report versions.

const PAYOUT_ARRIVAL = ['Arrival Date (UTC)', 'Arrival date (UTC)', 'Arrival Date', 'arrival_date'];
const PAYOUT_CREATED = ['Created date (UTC)', 'Created (UTC)', 'Created', 'created_utc'];

export function isStripePayouts(headers: string[]): boolean {
  const has = (n: string) => findCol(headers, n) >= 0;
  return has('id') && has('Amount') && findColAny(headers, PAYOUT_ARRIVAL) >= 0;
}

export type StripePayout = {
  id: string;
  arrival: string; // ISO
  created: string; // ISO
  amount: number;
  currency: string;
  status: string;
  type: string;
  description: string;
};

export type PayoutResult = {
  rows: StripePayout[];
  totals: { paidOut: number; count: number; average: number; currency: string; byStatus: { status: string; count: number; total: number }[] };
};

/** Reduce a Stripe Payouts export to rows + totals. */
export function parseStripePayouts(grid: Grid, decimal: '.' | ',' = '.'): PayoutResult {
  const h = grid.headers;
  const cId = findCol(h, 'id');
  const cArrival = findColAny(h, PAYOUT_ARRIVAL);
  const cCreated = findColAny(h, PAYOUT_CREATED);
  const cAmount = findCol(h, 'Amount');
  const cCurrency = findCol(h, 'Currency');
  const cStatus = findCol(h, 'Status');
  const cType = findColAny(h, ['Type', 'Method', 'Source Type', 'Destination Type']);
  const cDesc = findColAny(h, ['Description', 'Statement Descriptor']);

  const rows: StripePayout[] = [];
  let paidOut = 0;
  let currency = '';
  const byStatusMap = new Map<string, { count: number; total: number }>();

  for (const r of grid.rows) {
    const amount = money(r[cAmount], decimal);
    const status = (cStatus >= 0 ? r[cStatus] ?? '' : '').trim() || 'unknown';
    const cur = (cCurrency >= 0 ? r[cCurrency] ?? '' : '').trim().toUpperCase();
    if (cur && !currency) currency = cur;
    // "Paid out" = money that left Stripe or is on the way (not failed/canceled).
    if (!/fail|cancel|return/i.test(status)) paidOut += amount;
    const b = byStatusMap.get(status) ?? { count: 0, total: 0 };
    b.count++; b.total += amount; byStatusMap.set(status, b);
    rows.push({
      id: cId >= 0 ? (r[cId] ?? '').trim() : '',
      arrival: isoDate(cArrival >= 0 ? r[cArrival] : ''),
      created: isoDate(cCreated >= 0 ? r[cCreated] : ''),
      amount,
      currency: cur,
      status,
      type: cType >= 0 ? (r[cType] ?? '').trim() : '',
      description: cDesc >= 0 ? (r[cDesc] ?? '').trim() : '',
    });
  }

  const count = rows.length;
  return {
    rows,
    totals: {
      paidOut: round2(paidOut),
      count,
      average: count ? round2(paidOut / count) : 0,
      currency,
      byStatus: [...byStatusMap.entries()].map(([status, v]) => ({ status, count: v.count, total: round2(v.total) })).sort((a, b) => b.total - a.total),
    },
  };
}

// --- Subscriptions export → SaaS metrics ----------------------------------

/** True when the grid looks like a Stripe subscriptions export. */
export function isStripeSubscriptions(headers: string[]): boolean {
  const has = (n: string) => findCol(headers, n) >= 0;
  return has('Status') && has('Interval') && has('Amount') && (has('Product') || has('Plan') || has('id'));
}

/** Billing interval → number of times it bills per month (for MRR). */
function monthlyFactor(interval: string): number {
  switch (interval.toLowerCase().trim()) {
    case 'day': return 365 / 12;
    case 'week': return 52 / 12;
    case 'month': return 1;
    case 'year': return 1 / 12;
    default: return 1;
  }
}

// A subscription counts toward MRR while it is live and billing.
const LIVE = /^(active|past_due|trialing)$/i;
const PAYING = /^(active|past_due)$/i;

export type PlanRow = { plan: string; mrr: number; count: number };

export type SaasMetrics = {
  mrr: number;
  arr: number;
  arpu: number; // MRR / paying subscriptions
  activeCount: number; // paying (active + past_due)
  trialingCount: number;
  canceledCount: number;
  lostMrr: number; // MRR of canceled/ended subscriptions
  byPlan: PlanRow[];
  currency: string;
};

/**
 * MRR, ARR and churn signals from a Stripe subscriptions export. MRR is the
 * monthly-normalized amount of paying subscriptions (yearly plans ÷ 12, and so
 * on), times quantity. Trials are counted but excluded from MRR because they
 * are not yet paying. "Churn" here is the count and lost MRR of canceled
 * subscriptions in the file — a plain figure, not a cohort churn rate.
 */
export function saasMetrics(grid: Grid, decimal: '.' | ',' = '.'): SaasMetrics {
  const h = grid.headers;
  const cAmount = findCol(h, 'Amount');
  const cInterval = findCol(h, 'Interval');
  const cQty = findCol(h, 'Quantity');
  const cStatus = findCol(h, 'Status');
  const cCurrency = findCol(h, 'Currency');
  const cPlan = findCol(h, 'Product') >= 0 ? findCol(h, 'Product') : findCol(h, 'Plan');

  let mrr = 0, activeCount = 0, trialingCount = 0, canceledCount = 0, lostMrr = 0, currency = '';
  const plans = new Map<string, { mrr: number; count: number }>();

  for (const r of grid.rows) {
    const status = (cStatus >= 0 ? r[cStatus] ?? '' : '').trim();
    if (!status) continue;
    const amount = money(r[cAmount], decimal);
    const qty = cQty >= 0 ? Math.max(1, parseInt((r[cQty] ?? '1').trim(), 10) || 1) : 1;
    const interval = cInterval >= 0 ? r[cInterval] ?? 'month' : 'month';
    const monthly = round2(amount * qty * monthlyFactor(interval));
    const cur = (cCurrency >= 0 ? r[cCurrency] ?? '' : '').trim().toUpperCase();
    if (cur && !currency) currency = cur;

    if (/^trialing$/i.test(status)) trialingCount++;
    if (PAYING.test(status)) {
      activeCount++;
      mrr += monthly;
      const plan = (cPlan >= 0 ? (r[cPlan] ?? '').trim() : '') || '(unnamed plan)';
      const p = plans.get(plan) ?? { mrr: 0, count: 0 };
      p.mrr += monthly; p.count++; plans.set(plan, p);
    } else if (!LIVE.test(status)) {
      canceledCount++;
      lostMrr += monthly;
    }
  }

  mrr = round2(mrr);
  return {
    mrr,
    arr: round2(mrr * 12),
    arpu: activeCount ? round2(mrr / activeCount) : 0,
    activeCount,
    trialingCount,
    canceledCount,
    lostMrr: round2(lostMrr),
    byPlan: [...plans.entries()].map(([plan, v]) => ({ plan, mrr: round2(v.mrr), count: v.count })).sort((a, b) => b.mrr - a.mrr),
    currency,
  };
}
