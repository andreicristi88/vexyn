import { buildLines, parseStatement, detectDecimal, isAmount, isDate, isSummaryRow, type PdfTextItem } from '../src/lib/pdf';

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

console.log('\n--- layout D: month-name dates in another language (ING Romania) ---');
// From a real ING statement. The date arrives as three separate runs
// ("02" "septembrie" "2026") and "septembrie" is ten letters. Both broke
// detection: the month pattern capped words at nine, and only the FIRST token
// was tested for a date — so every row on the statement was silently skipped.
const pageD: PdfTextItem[] = [
  L('Data', 21, 770), L('Detalii tranzactie', 130, 770), R('Debit', 400, 770), R('Credit', 470, 770),
  L('02', 20, 750), L('septembrie', 32, 750), L('2026', 78, 750),
  L("Transfer Home'Bank", 130, 750), R('300,00', 400, 750),
  L('Beneficiar:Cineva', 130, 738),
  L('Referinta:178829379369201535653', 130, 726),
  L('05', 20, 700), L('octombrie', 32, 700), L('2026', 74, 700),
  L('Incasare', 130, 700), R('1.250,00', 470, 700),
  L('Sold final: 0,00', 20, 600),
];
const D = parseStatement(buildLines([pageD]));
eq('D month-name date detected', D.stats.transactions, 2);
eq('D two amount columns', D.amountColumns, 2);
eq('D debit row, credit blank', D.grid.rows[0].slice(2), ['300,00', '']);
eq('D credit row, debit blank', D.grid.rows[1].slice(2), ['', '1.250,00']);
eq('D full date kept together', D.grid.rows[0][0], '02 septembrie 2026');
eq('D detail lines joined in', D.grid.rows[0][1].includes('Referinta'), true);
eq('D closing balance not a transaction', D.grid.rows.some((r) => r[1].includes('Sold')), false);
eq('D long month word matches', isDate('02 septembrie 2026'), true);
eq('D english month still matches', isDate('5 Jan 2026'), true);

console.log('\n--- layout E: date printed once per day, dated summary rows (Banca Transilvania) ---');
// From a real BT statement, which broke three assumptions at once: the date is
// printed only on the first row of each day, the daily and running totals are
// themselves dated (so an anchored summary match against the whole line never
// fired and they were counted as transactions), and a summary block leaves a
// bare amount on a line of its own. Together these inflated every day by 3x.
const pageE: PdfTextItem[] = [
  L('Data', 22, 780), L('Descriere', 90, 780), R('Debit', 400, 780), R('Credit', 470, 780),
  L('SOLD ANTERIOR', 89, 764), R('2,822.64', 470, 764),
  L('01/09/2026', 28, 748), L('Incasare Instant', 90, 748), R('500.00', 470, 748),
  L('REF: 000ZEXA', 90, 736),
  L('Incasare Instant', 90, 724), R('200.00', 470, 724),
  L('Comision', 90, 712), R('7.50', 400, 712),
  L('01/09/2026', 28, 700), L('RULAJ ZI', 90, 700), R('7.50', 400, 700), R('700.00', 470, 700),
  L('Fonduri proprii Credit neutilizat', 90, 688), R('627.63', 470, 688),
  R('627.63', 470, 676),
];
const E = parseStatement(buildLines([pageE]));
const sumCol = (i: number) =>
  Math.round(E.grid.rows.reduce((s, r) => s + Number((r[2 + i] || '0').replace(/,/g, '')), 0) * 100) / 100;
eq('E only real transactions kept', E.stats.transactions, 3);
eq('E date carried to undated rows', E.grid.rows.every((r) => r[0] === '01/09/2026'), true);
eq('E credits sum to the daily total', sumCol(1), 700);
eq('E debits sum to the daily total', sumCol(0), 7.5);
eq('E dated RULAJ row skipped', E.grid.rows.some((r) => /RULAJ/i.test(r[1])), false);
eq('E opening balance skipped', E.grid.rows.some((r) => /SOLD/i.test(r[1])), false);
eq('E funds/limit block skipped', E.grid.rows.some((r) => /Fonduri|neutilizat/i.test(r[1])), false);
eq('E bare amount with no label skipped', E.grid.rows.some((r) => !r[1].trim()), false);
eq('E summary matched on description, not raw line', isSummaryRow('RULAJ ZI'), true);

console.log('\n--- layout F: currency codes and prose-embedded amounts (Revolut / BT) ---');
// Revolut writes the currency after the number ("12.50 RON"), which no leading
// symbol pattern matched — every amount on the statement failed and the file
// came back empty. Supporting it then broke Banca Transilvania, whose detail
// bullets quote money mid-sentence: "- 200.00 RON aferenta tranzactiei EPOS".
// Only TRAILING amounts are columns; a figure with description text still to
// its right is prose, not a table cell.
eq('F trailing currency code', isAmount('12.50 RON'), true);
eq('F leading currency code', isAmount('EUR 1.234,56'), true);
eq('F lowercase word is not a currency', isAmount('45.00 per'), false);
eq('F code must be exactly three letters', isAmount('12.50 RONALD'), false);
const pageF: PdfTextItem[] = [
  L('Date', 43, 780), L('Description', 125, 780), R('Money out', 376, 780), R('Money in', 464, 780), R('Balance', 560, 780),
  L('Sep', 43, 760), L('1,', 60, 760), L('2026', 72, 760),
  L('Burger Stuff', 125, 760), R('12.50 RON', 376, 760), R('142.28 RON', 560, 760),
  L('Transaction Id: 6a95691b', 125, 748),
  L('Sep', 43, 730), L('2,', 60, 730), L('2026', 72, 730),
  L('Apple Pay top-up', 125, 730), R('285.00 RON', 464, 730), R('287.33 RON', 560, 730),
  // BT-style detail bullet: money first, prose after — must NOT be a row
  L('-', 58, 712), L('200.00 RON', 62, 712), L('aferenta tranzactiei EPOS 31/08/2026', 109, 712),
];
const F = parseStatement(buildLines([pageF]));
eq('F transactions', F.stats.transactions, 2);
eq('F three columns, none invented by the bullet', F.amountColumns, 3);
eq('F money-out row', F.grid.rows[0].slice(2), ['12.50 RON', '', '142.28 RON']);
eq('F money-in row', F.grid.rows[1].slice(2), ['', '285.00 RON', '287.33 RON']);
eq('F prose bullet not a transaction', F.grid.rows.some((r) => /aferenta/.test(r[1])), false);
eq('F month-first date kept whole', F.grid.rows[0][0], 'Sep 1, 2026');

console.log('\n--- layout G: header block, bare amounts, and two tables (Revolut EUR) ---');
// A Revolut EUR statement carries two transaction tables — account and pockets
// — whose columns sit at different x. They cannot be merged safely, so the
// parser says so. It also used to offer every bare amount as a "figure the
// statement states", burying the three real ones under 42 lines of noise and
// disabling the only check a reader has.
const pageG: PdfTextItem[] = [
  L('Product', 43, 790), L('Opening balance', 125, 790), R('Money out', 360, 790), R('Money in', 456, 790), R('Balance', 560, 790),
  L('Account (Current Account)', 43, 778), R('€3.01', 240, 778), R('€1,213.00', 360, 778), R('€3,000.00', 456, 778), R('€1,790.01', 560, 778),
  L('Total', 43, 766), R('€3.01', 240, 766), R('€1,213.00', 360, 766), R('€3,000.00', 456, 766), R('€1,790.01', 560, 766),
  R('€627.63', 560, 754), // a figure with nothing naming it — not a checkable total
  L('Date', 43, 742), L('Description', 125, 742), R('Money out', 360, 742), R('Money in', 456, 742), R('Balance', 560, 742),
  // account table: money out at 360
  ...Array.from({ length: 12 }, (_, i) => [
    L(`0${(i % 9) + 1}/06/2026`, 43, 730 - i * 12),
    L('Coffee', 125, 730 - i * 12),
    R('€3.50', 360, 730 - i * 12),
    R('€100.00', 560, 730 - i * 12),
  ]).flat(),
  // one incoming row — the sparsely used column that betrays the overlay
  L('09/06/2026', 43, 580), L('Transfer in', 125, 580), R('€3,000.00', 456, 580), R('€3,100.00', 560, 580),
  // pockets table: its money column sits at 440, not 360
  ...Array.from({ length: 12 }, (_, i) => [
    L(`1${i % 9}/06/2026`, 43, 566 - i * 12),
    L('Pocket move', 125, 566 - i * 12),
    R('€1.00', 440, 566 - i * 12),
    R('€50.00', 560, 566 - i * 12),
  ]).flat(),
];
const G = parseStatement(buildLines([pageG]));
eq('G transactions', G.stats.transactions, 25);
eq('G four columns from the two geometries', G.amountColumns, 4);
eq('G warns that tables do not line up', /more than one transaction table/i.test(G.warnings.join(' ')), true);
eq('G declared holds only stated figures', G.declared.length, 2);
eq('G declared labels', G.declared.map((d) => d.label), ['Account (Current Account)', 'Total']);
eq('G bare amount is not offered as a total', G.declared.some((d) => d.amounts.includes('€627.63')), false);

console.log('\n--- failure modes are explicit, not silent ---');
const empty = parseStatement(buildLines([[]]));
eq('scanned pdf warns', /scan|OCR/i.test(empty.warnings.join(' ')), true);
eq('scanned pdf has no rows', empty.grid.rows.length, 0);
const noDates = parseStatement(buildLines([[L('SOME BANK', 50, 800), L('Statement of account', 50, 780)]]));
eq('no-amount warns', /no line carried an amount/i.test(noDates.warnings.join(' ')), true);
eq('no-date keeps lines for inspection', noDates.lines.length, 2);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
