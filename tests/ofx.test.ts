import { rowsToTxns, buildOfx, toAscii, parseDateToYmd, parseAmount, makeFitid, type OfxAccount } from '../src/lib/ofx';

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
// A bare YYYYMMDD leaves libofx no time to read, so it falls back to the clock
// at import — the same file imported late in the evening can move a
// transaction to the next day. Noon GMT is stable.
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

console.log(`\n${pass} passed, ${fail} failed\n`);
