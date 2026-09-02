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

// --- Balance change from activity (itemized) → reconciliation --------------
// Built to Stripe's documented itemized balance report. Column names have
// varied across report versions, so detection tries several candidates.
// VALIDATE against a real "Balance summary → Itemized" export.

const BAL_CATEGORY = ['reporting_category', 'Reporting Category', 'Type', 'type'];
const BAL_GROSS = ['gross', 'Gross', 'Amount', 'amount'];
const BAL_FEE = ['fee', 'Fee'];
const BAL_NET = ['net', 'Net'];
const BAL_PAYOUT = ['automatic_payout_id', 'payout_id', 'Payout ID', 'Automatic Payout ID'];
const BAL_ID = ['balance_transaction_id', 'id', 'Balance Transaction ID'];
const BAL_CREATED = ['created', 'created_utc', 'Created (UTC)', 'Created date (UTC)', 'balance_transaction_created_at'];

export function isBalanceReport(headers: string[]): boolean {
  return findColAny(headers, BAL_CATEGORY) >= 0 && findColAny(headers, BAL_NET) >= 0 && findColAny(headers, BAL_ID) >= 0;
}

export type CategoryTotal = { category: string; count: number; gross: number; fee: number; net: number };
export type PayoutTotal = { payoutId: string; count: number; net: number };

export type Reconciliation = {
  byCategory: CategoryTotal[];
  byPayout: PayoutTotal[];
  totals: { gross: number; fee: number; net: number; count: number; currency: string };
  /** net of everything that is NOT a payout — the money earned into the balance */
  activityNet: number;
  /** net of payout rows — money that left the balance to your bank (negative) */
  payoutNet: number;
};

/**
 * Group an itemized balance report by reporting category and by payout. The
 * sum of the `net` column is, by construction, the change in your Stripe
 * balance for the period — that is the figure to reconcile against the
 * report's own summary. Falls back to net = gross − fee when there is no net
 * column.
 */
export function reconcileBalance(grid: Grid, decimal: '.' | ',' = '.'): Reconciliation {
  const h = grid.headers;
  const cCat = findColAny(h, BAL_CATEGORY);
  const cGross = findColAny(h, BAL_GROSS);
  const cFee = findColAny(h, BAL_FEE);
  const cNet = findColAny(h, BAL_NET);
  const cPayout = findColAny(h, BAL_PAYOUT);
  const cCurrency = findCol(h, 'Currency') >= 0 ? findCol(h, 'Currency') : findCol(h, 'currency');

  const cats = new Map<string, { count: number; gross: number; fee: number; net: number }>();
  const payouts = new Map<string, { count: number; net: number }>();
  let gross = 0, fee = 0, net = 0, activityNet = 0, payoutNet = 0, count = 0, currency = '';

  for (const r of grid.rows) {
    const category = ((cCat >= 0 ? r[cCat] ?? '' : '').trim() || 'uncategorized').toLowerCase();
    const g = money(r[cGross], decimal);
    const f = money(r[cFee], decimal);
    const n = cNet >= 0 ? money(r[cNet], decimal) : round2(g - f);
    const cur = (cCurrency >= 0 ? r[cCurrency] ?? '' : '').trim().toUpperCase();
    if (cur && !currency) currency = cur;

    const c = cats.get(category) ?? { count: 0, gross: 0, fee: 0, net: 0 };
    c.count++; c.gross += g; c.fee += f; c.net += n; cats.set(category, c);

    gross += g; fee += f; net += n; count++;
    if (/payout/.test(category)) payoutNet += n; else activityNet += n;

    const pid = cPayout >= 0 ? (r[cPayout] ?? '').trim() : '';
    if (pid) { const p = payouts.get(pid) ?? { count: 0, net: 0 }; p.count++; p.net += n; payouts.set(pid, p); }
  }

  return {
    byCategory: [...cats.entries()].map(([category, v]) => ({ category, count: v.count, gross: round2(v.gross), fee: round2(v.fee), net: round2(v.net) })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    byPayout: [...payouts.entries()].map(([payoutId, v]) => ({ payoutId, count: v.count, net: round2(v.net) })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    totals: { gross: round2(gross), fee: round2(fee), net: round2(net), count, currency },
    activityNet: round2(activityNet),
    payoutNet: round2(payoutNet),
  };
}
