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
