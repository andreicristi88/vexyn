/**
 * Generic two-list transaction matcher — the engine behind reconciliation
 * (your records vs the bank, invoices vs payments, and so on). Deterministic:
 * greedy first-fit, so the same inputs always give the same result.
 *
 * Two transactions match when their amounts are within `amountTolerance` and
 * their dates within `dateToleranceDays`. Nothing is ever silently merged or
 * dropped — every row lands in exactly one of matched / only-in-A / only-in-B.
 */

import { daysBetween, round2, type Txn } from './statement';

export type MatchPair = { a: Txn; b: Txn };

export type MatchResult = {
  matched: MatchPair[];
  onlyA: Txn[];
  onlyB: Txn[];
};

export type MatchOptions = {
  /** max absolute difference in amount to still count as a match (default 0 = exact) */
  amountTolerance: number;
  /** max absolute difference in days to still count as a match (default 0 = same day) */
  dateToleranceDays: number;
};

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
  amountTolerance: 0,
  dateToleranceDays: 0,
};

export function matchTransactions(a: Txn[], b: Txn[], opts: MatchOptions = DEFAULT_MATCH_OPTIONS): MatchResult {
  const amtTol = Math.abs(opts.amountTolerance);
  const dayTol = Math.abs(opts.dateToleranceDays);
  const used = new Array(b.length).fill(false);
  const matched: MatchPair[] = [];
  const onlyA: Txn[] = [];

  for (const ta of a) {
    let found = -1;
    let bestDay = Infinity;
    for (let j = 0; j < b.length; j++) {
      if (used[j]) continue;
      if (Math.abs(round2(ta.amount - b[j].amount)) > amtTol) continue;
      const dd = Math.abs(daysBetween(ta.ymd, b[j].ymd));
      if (dd > dayTol) continue;
      // Prefer the closest date among candidates for a tidier match.
      if (dd < bestDay) { bestDay = dd; found = j; if (dd === 0) break; }
    }
    if (found >= 0) { used[found] = true; matched.push({ a: ta, b: b[found] }); }
    else onlyA.push(ta);
  }

  const onlyB = b.filter((_, j) => !used[j]);
  return { matched, onlyA, onlyB };
}

/** Signed sum of an amount column, rounded. */
export function sumAmount(txns: Txn[]): number {
  return round2(txns.reduce((s, t) => s + t.amount, 0));
}
