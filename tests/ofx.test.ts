import { rowsToTxns, buildOfx, toAscii, parseDateToYmd, parseAmount, makeFitid, readOfx, ofxRowsOf, OFX_READ_HEADERS, type OfxAccount } from '../src/lib/ofx';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`);
};
const has = (name: string, hay: string, needle: string) => eq(name, hay.includes(needle), true);

const account: OfxAccount = {
  bankId: 'BTRLRO22',
  acctId: 'RO49AAAA1B31007593840000',
  acctType: 'CHECKING',
  currency: 'RON',
};

console.log('\n--- reading the CSV ---');
eq('eu date', parseDateToYmd('01/09/2026', 'eu'), '20260901');
eq('us date', parseDateToYmd('09/01/2026', 'us'), '20260901');
eq('comma decimal with thousands', parseAmount('-1.234,56', ','), -1234.56);
eq('dot decimal with thousands', parseAmount('-1,234.56', '.'), -1234.56);
eq('unreadable amount is refused, not guessed', parseAmount('n/a', '.'), null);
eq('fitid is stable across runs', makeFitid('20260901', -15, 'Shop', 0), makeFitid('20260901', -15, 'Shop', 0));

console.log('\n--- what libofx rejects, and what it silently mangles ---');
// Every claim below was measured against the libofx that ships with GnuCash,
// using its own ofxdump. OFX 1.x is SGML and its parser refuses bytes above
// 127 whatever the header declares — USASCII, UTF-8 and UNICODE were all tried
// and all three produced the same errors, with "Cafenea Măgura" arriving as
// "Cafenea M": the name cut at the first accent, and the parse derailed far
// enough that the closing STMTRS tag was reported unfinished.
eq('romanian comma-below letters fold', toAscii('Cafenea Măgura ș ț Â Î'), 'Cafenea Magura s t A I');
eq('german and nordic letters fold', toAscii('Straße Ærø Køln'), 'Strasse AEro Koln');
eq('french accents fold', toAscii('Café Crème'), 'Cafe Creme');
eq('a non-latin script says it was dropped', toAscii('Кофейня'), '?');
eq('ascii is left exactly alone', toAscii('Kaufland & Co <SRL> 1234'), 'Kaufland & Co <SRL> 1234');

console.log('\n--- the document libofx accepts ---');
const { txns, errors } = rowsToTxns(
  [
    ['01/09/2026', '-1.234,56', 'Kaufland & Co SRL', 'POS 1234'],
    ['03/09/2026', '-49,99', 'Abonament Netflix International BV Amsterdam', ''],
    ['04/09/2026', '-15,00', 'Cafenea Măgura', 'card 4111'],
  ],
  { date: 0, amount: 1, name: 2, memo: 3, fitid: -1 },
  'eu',
  ',',
);
eq('all rows read', [txns.length, errors.length], [3, 0]);

const doc = buildOfx(txns, { ...account, balance: 1185.44 }, { qbo: false, org: 'Banca Transilvania', fid: '1234' });
eq('nothing above ASCII survives into the document', /[^\x00-\x7f]/.test(doc), false);
has('ampersand is escaped', doc, '<NAME>Kaufland &amp; Co SRL');
has('accents are folded, not truncated', doc, 'Cafenea Magura');
// LEDGERBAL is required inside STMTRS. Without it libofx still reads the
// transactions but reports "end tag for STMTRS which is not finished", and a
// stricter importer may refuse the file outright.
has('ledger balance is present', doc, '<LEDGERBAL>\n<BALAMT>1185.44');
eq('balance defaults to 0.00 when not stated', buildOfx(txns, account, { qbo: false }).includes('<BALAMT>0.00'), true);
// A bare YYYYMMDD leaves libofx no time to read: it warns once per date, then
// takes the time from the clock at import, so the same file read twice gets two
// different timestamps. It does not change the day — that was assumed and then
// measured, and the date came back from the file either way. Noon GMT makes the
// timestamp deterministic and the parse warning-free.
has('dates carry an explicit time and offset', doc, '<DTPOSTED>20260901120000.000[0:GMT]');
has('the statement window carries one too', doc, '<DTSTART>20260901120000.000[0:GMT]');
has('so does the balance date', doc, '<DTASOF>20260904120000.000[0:GMT]');
// NAME is capped at 32 by the format; the remainder used to be dropped. The
// cut lands mid-space here, so the value is trimmed rather than shipped with a
// trailing blank.
has('long name is cut in NAME, without a trailing space', doc, '<NAME>Abonament Netflix International\n');
has('long name survives whole in MEMO', doc, '<MEMO>Abonament Netflix International BV Amsterdam');
eq('a supplied memo is not overwritten by the name', doc.includes('<MEMO>POS 1234'), true);

const qbo = buildOfx(txns, account, { qbo: true, intuBid: '3000' });
has('qbo carries the Intuit id', qbo, '<INTU.BID>3000');
has('qbo is otherwise the same document', qbo, '<LEDGERBAL>');

console.log('\n--- reading OFX back: 1.x SGML, 2.x XML, credit cards ---');
// Cross-checked against libofx itself: the same three fixtures were given to
// ofxdump and to readOfx, and every transaction agreed on date, amount, payee
// and FITID. What follows pins the behaviour libofx does not expose — the
// account column, the warnings, and the values we deliberately do not rewrite.
const sgml = buildOfx(
  [{ datePosted: '20260901', amount: -15.5, name: 'Coffee & Co', memo: 'card 4111', fitid: 'F1' }],
  { bankId: 'B', acctId: 'ACC-1', acctType: 'CHECKING', currency: 'RON', balance: 10 },
  { qbo: false },
);
const back = readOfx(sgml);
eq('round trip keeps one transaction', back.txns.length, 1);
eq('date comes back as ISO', back.txns[0].date, '2026-09-01');
eq('amount comes back exactly as written', back.txns[0].amount, '-15.50');
eq('the escaped ampersand is decoded once', back.txns[0].name, 'Coffee & Co');
eq('account is carried onto the row', back.txns[0].account, 'ACC-1');
eq('a clean file warns about nothing', back.warnings, []);

// XML form: leaf tags are closed, so the scanner must not read the closing tag
// as an empty value that wipes the one before it.
const xml = readOfx(
  `<OFX><BANKMSGSRSV1><STMTRS><CURDEF>EUR</CURDEF>` +
    `<BANKACCTFROM><ACCTID>NL91ABNA</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>` +
    `<BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260805120000.000[0:GMT]</DTPOSTED>` +
    `<TRNAMT>-42.00</TRNAMT><FITID>X1</FITID><NAME>Albert Heijn</NAME></STMTTRN></BANKTRANLIST></STMTRS></BANKMSGSRSV1></OFX>`,
);
eq('xml transaction is read', [xml.txns.length, xml.txns[0]?.name, xml.txns[0]?.amount], [1, 'Albert Heijn', '-42.00']);
eq('a timestamp with offset keeps the bankposted day', xml.txns[0].date, '2026-08-05');

// Two statements in one file: each transaction must carry its own account, or
// a merged CSV silently attributes money to the wrong one.
const two = readOfx(
  `<OFX><BANKMSGSRSV1>` +
    `<STMTRS><CURDEF>EUR<BANKACCTFROM><ACCTID>AAA</ACCTID></BANKACCTFROM><BANKTRANLIST>` +
    `<STMTTRN><DTPOSTED>20260801<TRNAMT>-1.00<FITID>1<NAME>One</STMTTRN></BANKTRANLIST></STMTRS>` +
    `<STMTRS><CURDEF>USD<BANKACCTFROM><ACCTID>BBB</ACCTID></BANKACCTFROM><BANKTRANLIST>` +
    `<STMTTRN><DTPOSTED>20260802<TRNAMT>-2.00<FITID>2<NAME>Two</STMTTRN></BANKTRANLIST></STMTRS>` +
    `</BANKMSGSRSV1></OFX>`,
);
eq('both statements are read', two.txns.length, 2);
eq('each row keeps its own account', two.txns.map((t) => t.account), ['AAA', 'BBB']);
eq('each row keeps its own currency', two.txns.map((t) => t.currency), ['EUR', 'USD']);
eq('both accounts are listed', two.accounts.map((a) => a.acctId), ['AAA', 'BBB']);

console.log('\n--- reading OFX: what it refuses to do quietly ---');
eq('a file that is not OFX is named as such', readOfx('date,amount\n2026-01-01,5').warnings[0], 'No <OFX> element — this does not look like an OFX, QFX or QBO file.');
eq('and returns nothing rather than guessing', readOfx('nonsense').txns.length, 0);
eq('an OFX with no transactions says so', /no <STMTTRN> entries/i.test(readOfx('<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>').warnings.join(' ')), true);
// A comma decimal is out of spec but real. Rewriting it would be a silent edit
// to the one number that must never be edited, so it is passed through named.
const comma = readOfx('<OFX><STMTRS><BANKTRANLIST><STMTTRN><DTPOSTED>20260801<TRNAMT>-15,50<FITID>1<NAME>X</STMTTRN></BANKTRANLIST></STMTRS></OFX>');
eq('a comma amount is passed through untouched', comma.txns[0].amount, '-15,50');
eq('and is flagged', /comma decimal/i.test(comma.warnings.join(' ')), true);
const inv = readOfx('<OFX><INVSTMTRS><INVTRANLIST></INVTRANLIST></INVSTMTRS></OFX>');
eq('an investment statement is named as unread', /investment statement/i.test(inv.warnings.join(' ')), true);
eq('rows line up with the headers', ofxRowsOf(back)[0].length, OFX_READ_HEADERS.length);
console.log(`\n${pass} passed, ${fail} failed\n`);
