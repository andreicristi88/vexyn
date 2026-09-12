import { cellToText, sheetToCsv, parseCsv } from '../src/lib/csv';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`);
};

// The reader (read-excel-file) hands back typed cells: string, number,
// boolean, Date at UTC, or null. What follows is our side of the line — the
// cells as text, with as little opinion as possible. The real reader was run
// once against a workbook written by openpyxl, and this is what came back.

console.log('\n--- a cell as text ---');
eq('text stays text, leading zeros and all', cellToText('00123'), '00123');
eq('a number prints as the double it is', cellToText(-1234.5), '-1234.5');
eq('an integer has no decimals added', cellToText(4111), '4111');
eq('a date at midnight is a date', cellToText(new Date(Date.UTC(2026, 8, 1))), '2026-09-01');
eq('a time is kept', cellToText(new Date(Date.UTC(2026, 8, 2, 14, 30))), '2026-09-02 14:30:00');
// 14:30 is a fraction of a day in a double, and reads back as 14:29:59.999.
eq('a time is rounded to the second', cellToText(new Date(Date.UTC(2026, 8, 2, 14, 29, 59, 999))), '2026-09-02 14:30:00');
eq('booleans', [cellToText(true), cellToText(false)], ['TRUE', 'FALSE']);
eq('an empty cell is empty', [cellToText(null), cellToText(undefined)], ['', '']);

console.log('\n--- a sheet as CSV ---');
const csv = sheetToCsv([
  ['Date', 'Account', 'Amount', 'Payee'],
  [new Date(Date.UTC(2026, 8, 1)), '00123', -1234.5, 'Kaufland & Co, SRL'],
  ['2026-09-02', 4111, 0.3, null],
  ['', '', '', ''],
  [null, null, null, null],
]);
eq('trailing blank rows are dropped', csv.split('\n').length, 3);
eq('a comma inside a value is quoted', csv.includes('"Kaufland & Co, SRL"'), true);
const g = parseCsv(csv, true);
eq('it round-trips through parseCsv', g.ok && g.grid.rows[0], ['2026-09-01', '00123', '-1234.5', 'Kaufland & Co, SRL']);
eq('a short row is padded, not misaligned', g.ok && g.grid.rows[1], ['2026-09-02', '4111', '0.3', '']);
eq('a ragged sheet pads to its widest row', sheetToCsv([['a'], ['b', 'c', 'd']]).split(/\r?\n/)[0], 'a,,');
eq('an empty sheet is empty text', sheetToCsv([]), '');

console.log(`\n${pass} passed, ${fail} failed\n`);
