import { parseCsv, gridToRecords, mergeGrids, cleanGrid, uniqueNames, DEFAULT_CLEAN_OPTIONS, type Grid } from '../src/lib/csv';
import { computeSaasMetrics, type SaasMap } from '../src/lib/saas';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`);
};
const grid = (csv: string): Grid => {
  const r = parseCsv(csv, true);
  if (!r.ok) throw new Error(r.error);
  return r.grid;
};

// Four defects reported from outside on 2 October 2026, each reproduced
// before it was fixed. Every case below failed against the old code.

console.log('\n--- unique column names ---');
eq('names that are already unique are untouched', uniqueNames(['a', 'b', 'c']), ['a', 'b', 'c']);
eq('a repeat keeps its first occurrence and numbers the rest', uniqueNames(['amount', 'amount', 'amount']), ['amount', 'amount (2)', 'amount (3)']);
// The old cleaner numbered blindly and produced the duplicate it was meant to remove.
eq('a suffix another column already carries is skipped', uniqueNames(['x', 'x', 'x (2)']), ['x', 'x (3)', 'x (2)']);
eq('matching is case-insensitive, like the merger', uniqueNames(['Amount', 'amount']), ['Amount', 'amount (2)']);
eq('the result has no duplicates even in a worst case', new Set(uniqueNames(['x', 'x (2)', 'x', 'x (3)', 'x']).map((n) => n.toLowerCase())).size, 5);

console.log('\n--- header cleaning ---');
const cleaned = cleanGrid(grid('x,x,x (2)\n1,2,3'), { ...DEFAULT_CLEAN_OPTIONS, cleanHeaders: true });
eq('cleaning x, x, x (2) leaves every header distinct', cleaned.grid.headers, ['x', 'x (3)', 'x (2)']);
eq('only the renamed header is counted', cleaned.stats.headersRenamed, 1);
eq('blank headers are named and still unique', cleanGrid(grid('Column 2,,\n1,2,3'), { ...DEFAULT_CLEAN_OPTIONS, cleanHeaders: true }).grid.headers, ['Column 2', 'Column 2 (2)', 'Column 3']);

console.log('\n--- JSON keeps every value ---');
eq('two columns named amount both reach the JSON', gridToRecords(grid('amount,amount\n100,200')), [{ amount: '100', 'amount (2)': '200' }]);

console.log('\n--- merging keeps every column ---');
const merged = mergeGrids([grid('amount,amount\n100,200'), grid('amount,amount\n1,2')]);
eq('a repeated name keeps both columns', merged.headers, ['amount', 'amount (2)']);
eq('and both columns keep their values', merged.rows, [['100', '200'], ['1', '2']]);
const shifted = mergeGrids([grid('id,amount\nA,1'), grid('amount,id\n2,B')]);
eq('plain merges still align by name', shifted.rows, [['A', '1'], ['B', '2']]);

console.log('\n--- SaaS metrics never add currencies together ---');
const map = (g: Grid): SaasMap => ({ amount: g.headers.indexOf('amount'), currency: g.headers.indexOf('currency'), interval: -1, status: -1, quantity: -1, plan: -1 });
const mixed = grid('amount,currency\n100,usd\n100,eur');
const def = computeSaasMetrics(mixed, map(mixed));
eq('100 USD + 100 EUR is not 200 of anything', def.mrr, 100);
eq('the figure names the currency it covers', def.currency, 'USD');
eq('and the others are listed', def.currencies, ['USD', 'EUR']);
eq('and the row it left out is counted', def.excluded, 1);
eq('switching currency gives that currency alone', computeSaasMetrics(mixed, map(mixed), '.', 'EUR').mrr, 100);
const blank = grid('amount,currency\n100,usd\n100,eur\n50,');
eq('in a mixed file a row with no currency cannot be placed', computeSaasMetrics(blank, map(blank)).excluded, 2);
const single = grid('amount,currency\n100,usd\n50,');
eq('in a single-currency file it belongs to that currency', computeSaasMetrics(single, map(single)).mrr, 150);
const none = grid('amount\n100\n50');
eq('with no currency column nothing changes', computeSaasMetrics(none, { ...map(none), currency: -1 }).mrr, 150);

console.log(`\n${pass} passed, ${fail} failed\n`);
