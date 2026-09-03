import { buildLines, parseStatement, detectDecimal, isAmount, isDate, type PdfTextItem } from '../src/lib/pdf';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${g}\n       want ${w}`); }
};

// Text runs are right-aligned for money, so build them from the right edge.
const L = (str: string, x: number, y: number, w = str.length * 4.2): PdfTextItem => ({ str, x, y, width: w });
const R = (str: string, right: number, y: number, w = str.length * 4.2): PdfTextItem => ({ str, x: right - w, y, width: w });

console.log('\n--- token classification ---');
eq('date not money (31.01.2026)', isAmount('31.01.2026'), false);
eq('eu amount', isAmount('1.234,56'), true);
eq('us amount', isAmount('1,234.56'), true);
eq('negative', isAmount('-12,34'), true);
eq('parenthesised', isAmount('(45.00)'), true);
eq('trailing CR', isAmount('45.00 CR'), true);
eq('bare integer rejected by default', isAmount('500'), false);
eq('bare integer allowed when relaxed', isAmount('500', false), true);
eq('reference number rejected', isAmount('4029381'), false);
eq('date recognised', isDate('31.01.2026'), true);
eq('month-name date', isDate('5 Jan 2026'), true);

console.log('\n--- layout A: signed amount + balance, wrapped description, page furniture ---');
const pageA: PdfTextItem[] = [
  // header row (no date -> must be ignored)
  L('Date', 50, 800), L('Description', 105, 800), R('Amount', 480, 800), R('Balance', 560, 800),
  // txn 1, split runs to exercise token merging: "1.234" + ",56"
  L('31.01.2026', 50, 780), L('ACME LTD', 105, 780), R('-12,34', 480, 780),
  ...(() => { const w = 40; const x = 560 - w; return [L('1.234', x, 780, 25), L(',56', x + 25, 780, 15)]; })(),
  // wrapped description
  L('SUBSCRIPTION FEE', 107, 766),
  // txn 2
  L('01.02.2026', 50, 750), L('REFUND', 105, 750), R('55,00', 480, 750), R('1.289,56', 560, 750),
  // centred footer far below — must NOT become a continuation
  L('Page 1 of 2', 260, 40),
];
const linesA = buildLines([pageA]);
const A = parseStatement(linesA);
eq('A decimal detected', detectDecimal(linesA), ',');
eq('A headers', A.grid.headers, ['Date', 'Description', 'Amount 1', 'Amount 2']);
eq('A transactions', A.stats.transactions, 2);
eq('A continuations', A.stats.continuations, 1);
eq('A row1', A.grid.rows[0], ['31.01.2026', 'ACME LTD SUBSCRIPTION FEE', '-12,34', '1.234,56']);
eq('A row2', A.grid.rows[1], ['01.02.2026', 'REFUND', '55,00', '1.289,56']);
eq('A footer excluded', A.grid.rows.some((r) => r[1].includes('Page 1')), false);
eq('A no warnings', A.warnings.length, 0);

console.log('\n--- layout B: separate debit / credit, blanks must stay blank ---');
const pageB: PdfTextItem[] = [
  L('Date', 50, 800), L('Details', 105, 800), R('Debit', 400, 800), R('Credit', 470, 800), R('Balance', 545, 800),
  L('02/03/2026', 50, 780), L('CARD PURCHASE', 105, 780), R('25.00', 400, 780), R('975.00', 545, 780),
  L('03/03/2026', 50, 764), L('SALARY', 105, 764), R('2,500.00', 470, 764), R('3,475.00', 545, 764),
  L('04/03/2026', 50, 748), L('ATM', 105, 748), R('100.00', 400, 748), R('3,375.00', 545, 748),
];
const linesB = buildLines([pageB]);
const B = parseStatement(linesB);
eq('B decimal detected', detectDecimal(linesB), '.');
eq('B three amount columns', B.amountColumns, 3);
eq('B debit row (credit blank)', B.grid.rows[0], ['02/03/2026', 'CARD PURCHASE', '25.00', '', '975.00']);
eq('B credit row (debit blank)', B.grid.rows[1], ['03/03/2026', 'SALARY', '', '2,500.00', '3,475.00']);
eq('B debit row 2', B.grid.rows[2], ['04/03/2026', 'ATM', '100.00', '', '3,375.00']);

console.log('\n--- layout C: multi-page, header repeats on page 2 ---');
const pageC2: PdfTextItem[] = [
  L('Date', 50, 800), L('Description', 105, 800), R('Amount', 480, 800),
  L('05.03.2026', 50, 780), L('RENT', 105, 780), R('-450,00', 480, 780),
];
const C = parseStatement(buildLines([pageA, pageC2]));
eq('C transactions across pages', C.stats.transactions, 3);
eq('C page 2 row', C.grid.rows[2][1], 'RENT');
eq('C reports 2 pages', C.stats.pages, 2);

console.log('\n--- failure modes are explicit, not silent ---');
const empty = parseStatement(buildLines([[]]));
eq('scanned pdf warns', /scan|OCR/i.test(empty.warnings.join(' ')), true);
eq('scanned pdf has no rows', empty.grid.rows.length, 0);
const noDates = parseStatement(buildLines([[L('SOME BANK', 50, 800), L('Statement of account', 50, 780)]]));
eq('no-date warns', /no line began with a date/i.test(noDates.warnings.join(' ')), true);
eq('no-date keeps lines for inspection', noDates.lines.length, 2);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
