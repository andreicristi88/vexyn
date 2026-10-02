/**
 * Generic SaaS metrics from any subscriptions export — Stripe, Chargebee,
 * Paddle, or a plain spreadsheet. The caller maps the columns (amount,
 * interval, quantity, status, plan), so nothing is tied to one provider's
 * header names.
 *
 * MRR normalizes every paying subscription to a monthly figure (yearly ÷ 12,
 * weekly and daily scaled) times quantity. Trials are counted but excluded.
 * Churn is a plain snapshot — count and lost MRR of ended subscriptions — not
 * a cohort rate, which needs a period and a starting base an export lacks.
 */

import { parseAmount } from './ofx';
import type { Grid } from './csv';

export type SaasMap = {
  amount: number;
  /** column with a billing interval word (month/year/week/day); -1 = amounts are already monthly */
  interval: number;
  /** -1 = quantity 1 for every row */
  quantity: number;
  /** -1 = treat every row as an active paying subscription */
  status: number;
  /** -1 = no per-plan breakdown */
  plan: number;
  currency: number;
};

export const DEFAULT_SAAS_MAP: SaasMap = { amount: -1, interval: -1, quantity: -1, status: -1, plan: -1, currency: -1 };

export type PlanRow = { plan: string; mrr: number; count: number };

export type SaasMetrics = {
  mrr: number;
  arr: number;
  arpu: number;
  activeCount: number;
  trialingCount: number;
  canceledCount: number;
  lostMrr: number;
  byPlan: PlanRow[];
  /** The currency these figures are in — the only one they were summed over. */
  currency: string;
  /** Every currency in the file. More than one means the figures above cover one of them only. */
  currencies: string[];
  /** Rows left out because they are in another currency, or carry none in a mixed file. */
  excluded: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Interval word → times it bills per month. Unknown/blank = monthly. */
export function monthlyFactor(interval: string): number {
  const s = (interval || '').toLowerCase();
  if (/year|annual|yr\b/.test(s)) return 1 / 12;
  if (/quarter/.test(s)) return 1 / 3;
  if (/week/.test(s)) return 52 / 12;
  if (/day|daily/.test(s)) return 365 / 12;
  return 1; // month / monthly / blank
}

const PAYING = /^(active|past_due|paying|live)$/i;
const TRIAL = /^(trialing|trial|in_trial)$/i;

/**
 * Metrics for one currency at a time.
 *
 * MRR used to be summed across every row whatever its currency, so 100 USD
 * and 100 EUR came out as "200 USD" — the currency label taken from the first
 * row, the sum meaningless, and nothing said. There is no honest single
 * figure for a mixed file without exchange rates, and choosing rates is a
 * decision this tool should not make for anyone. So it computes for one
 * currency, lists the others, and the page lets the reader switch.
 *
 * Rows with no currency belong to the file's currency when it has only one;
 * in a mixed file they cannot be placed, and are excluded and counted.
 */
export function computeSaasMetrics(grid: Grid, map: SaasMap, decimal: '.' | ',' = '.', onlyCurrency?: string): SaasMetrics {
  let mrr = 0, activeCount = 0, trialingCount = 0, canceledCount = 0, lostMrr = 0, excluded = 0;
  const plans = new Map<string, { mrr: number; count: number }>();
  const curOf = (r: string[]) => (map.currency >= 0 ? r[map.currency] ?? '' : '').trim().toUpperCase();

  const currencies: string[] = [];
  for (const r of grid.rows) {
    const c = curOf(r);
    if (c && !currencies.includes(c)) currencies.push(c);
  }
  const mixed = currencies.length > 1;
  const currency = onlyCurrency && currencies.includes(onlyCurrency) ? onlyCurrency : currencies[0] ?? '';

  for (const r of grid.rows) {
    const rawAmount = map.amount >= 0 ? r[map.amount] ?? '' : '';
    const parsed = parseAmount(rawAmount, decimal);
    if (parsed === null) continue; // no amount → not a subscription row
    const amount = parsed;
    const qty = map.quantity >= 0 ? Math.max(1, parseInt((r[map.quantity] ?? '1').trim(), 10) || 1) : 1;
    const intervalStr = map.interval >= 0 ? r[map.interval] ?? '' : '';
    const monthly = round2(amount * qty * (map.interval >= 0 ? monthlyFactor(intervalStr) : 1));
    const cur = curOf(r);
    if (mixed && cur !== currency) { excluded++; continue; }

    // No status column → treat every row as a paying subscription.
    const status = map.status >= 0 ? (r[map.status] ?? '').trim() : 'active';
    if (!status) continue;

    if (TRIAL.test(status)) { trialingCount++; continue; }
    if (map.status < 0 || PAYING.test(status)) {
      activeCount++;
      mrr += monthly;
      const plan = (map.plan >= 0 ? (r[map.plan] ?? '').trim() : '') || '(unnamed plan)';
      const p = plans.get(plan) ?? { mrr: 0, count: 0 };
      p.mrr += monthly; p.count++; plans.set(plan, p);
    } else {
      // canceled / ended / expired / unpaid / paused …
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
    currencies,
    excluded,
  };
}
