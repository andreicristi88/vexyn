import { readMt940, mt940RowsOf, MT940_HEADERS } from '../src/lib/mt940';
import { readCamt, camtRowsOf, CAMT_HEADERS, parseXml } from '../src/lib/camt';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`);
};

// Cross-checked against the aqbanking SWIFT importer shipped with GnuCash: the
// same fixtures through both, and dates, amounts, payee, purpose and
// references agreed. What follows pins the behaviour that check does not
// cover, plus the two places we deliberately read more than the reference.

console.log('\n--- MT940: German structured :86: ---');
const de = readMt940([
  ':20:STARTUMSE', ':25:DE89370400440532013000', ':28C:00001/001', ':60F:C260901EUR1234,56',
  ':61:2609020902D42,00NTRFNONREF//1234567890',
  ':86:020?00SEPA-LASTSCHRIFT?20EREF+ABC123?21MREF+M1?22SVWZ+Groceries wk 36?32ALBERT HEIJN?33FILIAAL 12',
  ':61:2609050905C1800,00NTRFNONREF//9876',
  ':86:051?00SEPA-GUTSCHRIFT?20SALARY SEPT?32EMPLOYER BV',
  ':61:260907D15,00NMSCNONREF',
  ':86:CAFENEA MAGURA CARD 4111',
  ':62F:C260907EUR2977,56', '-', '',
].join('\r\n'));
eq('three entries', de.txns.length, 3);
eq('value date and entry date', [de.txns[0].date, de.txns[0].entryDate], ['2026-09-02', '2026-09-02']);
eq('debit is negative, comma becomes dot', de.txns[0].amount, '-42.00');
eq('credit is positive', de.txns[1].amount, '1800.00');
eq('currency comes from :60F:', de.txns[0].currency, 'EUR');
// ?32 and ?33 are one name cut at 27 characters, sometimes mid-word: no space.
eq('payee joins ?32 and ?33 with nothing', de.txns[0].payee, 'ALBERT HEIJNFILIAAL 12');
eq('SVWZ+ is the purpose, EREF+ the end-to-end ref', [de.txns[0].purpose, de.txns[0].e2eRef], ['Groceries wk 36', 'ABC123']);
eq('?00 is the transaction text', de.txns[0].txnText, 'SEPA-LASTSCHRIFT');
eq('bank reference after //', de.txns[0].bankRef, '1234567890');
eq('NONREF is no reference', de.txns[0].reference, '');
eq('the :61: code', de.txns[2].code, 'MSC');
eq('free-text :86: is the purpose', de.txns[2].purpose, 'CAFENEA MAGURA CARD 4111');
eq('opening and closing balances', de.accounts, [{ account: 'DE89370400440532013000', currency: 'EUR', opening: '1234.56', closing: '2977.56' }]);
eq('nothing to warn about', de.warnings, []);

console.log('\n--- MT940: Dutch form, envelope, wraps, reversal ---');
const nl = readMt940([
  '{1:F01ABNANL2AAXXX0000000000}{2:I940ABNANL2AXXXXN}{4:',
  ':20:ABN AMRO BANK NV', ':25:NL91ABNA0417164300', ':28C:35201/1', ':60F:C260801EUR500,00',
  ':61:260803D12,50NIDBNONREF', '/TRCD/00100/',
  ':86:BEA NR:XYZ123 03.08.26/12.15 JUMBO AMSTERDAM,PAS123',
  ':61:260810C250,00NTRF1234567890//AB12',
  // a hard wrap at 65 characters lands on the space after "DE": it must survive
  ':86:/TRTP/SEPA OVERBOEKING/IBAN/NL02ABNA0123456789/BIC/ABNANL2A/NAME/J DE ',
  'VRIES/REMI/Terugbetaling etentje/EREF/NOTPROVIDED',
  ':61:260812RC10,00NRTINONREF', ':86:Storno incasso',
  ':62F:C260812EUR727,50', '-}', '',
].join('\r\n'));
eq('the SWIFT envelope is skipped', nl.txns.length, 3);
eq('the :61: supplement line joins the details', nl.txns[0].detail, '/TRCD/00100/ BEA NR:XYZ123 03.08.26/12.15 JUMBO AMSTERDAM,PAS123');
// aqbanking leaves the Dutch /TAG/ form as one string with no payee; the tags
// are documented, so they are read.
eq('/NAME/ is the payee, with the wrapped space intact', nl.txns[1].payee, 'J DE VRIES');
eq('/REMI/ is the purpose', nl.txns[1].purpose, 'Terugbetaling etentje');
eq('NOTPROVIDED is no reference', nl.txns[1].e2eRef, '');
eq('customer reference before //', [nl.txns[1].reference, nl.txns[1].bankRef], ['1234567890', 'AB12']);
eq('a reversed credit (RC) is money going out', nl.txns[2].amount, '-10.00');

console.log('\n--- MT940: pages and refusals ---');
const pages = readMt940([
  ':20:P1', ':25:DE11', ':28C:7/1', ':60F:C260901EUR0,00',
  ':61:260901C100,00NTRFNONREF', ':86:020?20one?32A', ':62M:C260901EUR100,00', '-',
  ':20:P2', ':25:DE11', ':28C:7/2', ':60M:C260901EUR100,00',
  ':61:260902D30,00NTRFNONREF', ':86:020?20two?32B', ':62F:C260902EUR70,00', '-', '',
].join('\n'));
eq('two pages of one statement read as one', pages.txns.map((t) => t.payee), ['A', 'B']);
eq('one account, balances from :60F: and :62F: only', pages.accounts, [{ account: 'DE11', currency: 'EUR', opening: '0.00', closing: '70.00' }]);
// "?20" loose in free text is not the structured form; that needs the GVC code.
eq('a bare ?20 in free text is not structured', readMt940(':20:X\n:25:A\n:60F:C260901EUR0,00\n:61:260901D1,00NMSCNONREF\n:86:call ?20 for help\n:62F:C260901EUR0,00\n').txns[0].purpose, 'call ?20 for help');
eq('not an MT940', readMt940('date,amount\n2026-01-01,5').warnings[0], 'No :20: field — this does not look like an MT940 statement.');
eq('an unreadable :61: is skipped and named', /skipped/.test(readMt940(':20:X\n:25:A\n:60F:C260901EUR0,00\n:61:garbage\n:62F:C260901EUR0,00\n').warnings.join(' ')), true);
eq('rows line up with headers', mt940RowsOf(de)[0].length, MT940_HEADERS.length);

// Cross-checked against the aqbanking camt importer: it reads camt.052 only, so
// the same entries were wrapped as a camt.052 report for it, and dates,
// amounts, counterparties, purposes and end-to-end references agreed.

console.log('\n--- CAMT.053 ---');
const camt = readCamt(`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><GrpHdr><MsgId>M1</MsgId></GrpHdr>
<Stmt><Id>S1</Id><Acct><Id><IBAN>NL91ABNA0417164300</IBAN></Id><Ccy>EUR</Ccy></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">500.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-08-01</Dt></Dt></Bal>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">120.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><Dt><Dt>2026-08-31</Dt></Dt></Bal>
<Ntry><Amt Ccy="EUR">42.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-08-05</Dt></BookgDt><ValDt><DtTm>2026-08-06T00:00:00</DtTm></ValDt><AcctSvcrRef>BR001</AcctSvcrRef>
 <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>IDDT</Cd><SubFmlyCd>ESDD</SubFmlyCd></Fmly></Domn></BkTxCd>
 <NtryDtls><TxDtls><Refs><EndToEndId>E2E-1</EndToEndId><MndtId>MND-9</MndtId></Refs>
  <RltdPties><Dbtr><Nm>Own Account</Nm></Dbtr><Cdtr><Nm>Albert Heijn &amp; Co</Nm></Cdtr><CdtrAcct><Id><IBAN>NL02ABNA0123456789</IBAN></Id></CdtrAcct></RltdPties>
  <RmtInf><Ustrd>Groceries</Ustrd><Ustrd>week 32</Ustrd></RmtInf></TxDtls></NtryDtls><AddtlNtryInf>SEPA Incasso</AddtlNtryInf></Ntry>
<Ntry><Amt Ccy="EUR">1800.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-08-25</Dt></BookgDt><ValDt><Dt>2026-08-25</Dt></ValDt>
 <NtryDtls><TxDtls><Refs><EndToEndId>NOTPROVIDED</EndToEndId></Refs><RltdPties><Dbtr><Nm>Employer BV</Nm></Dbtr><DbtrAcct><Id><IBAN>NL77INGB0001234567</IBAN></Id></DbtrAcct></RltdPties></TxDtls></NtryDtls></Ntry>
</Stmt></BkToCstmrStmt></Document>`);
eq('two entries', camt.txns.length, 2);
eq('debit is signed, amount otherwise as written', camt.txns[0].amount, '-42.00');
eq('booking date and value date, DtTm cut to the day', [camt.txns[0].date, camt.txns[0].valueDate], ['2026-08-05', '2026-08-06']);
eq('money out names the creditor, entity decoded', [camt.txns[0].counterparty, camt.txns[0].counterpartyIban], ['Albert Heijn & Co', 'NL02ABNA0123456789']);
eq('money in names the debtor', [camt.txns[1].counterparty, camt.txns[1].counterpartyIban], ['Employer BV', 'NL77INGB0001234567']);
eq('several Ustrd lines join', camt.txns[0].purpose, 'Groceries week 32');
eq('references', [camt.txns[0].bankRef, camt.txns[0].e2eRef, camt.txns[0].mandateId], ['BR001', 'E2E-1', 'MND-9']);
eq('NOTPROVIDED is no reference', camt.txns[1].e2eRef, '');
eq('bank transaction code as domain/family/subfamily', camt.txns[0].code, 'PMNT/IDDT/ESDD');
eq('the bank description', camt.txns[0].info, 'SEPA Incasso');
eq('balances, a debit closing balance is negative', camt.accounts, [{ account: 'NL91ABNA0417164300', currency: 'EUR', opening: '500.00', closing: '-120.00' }]);

console.log('\n--- CAMT: namespaces, batches, reversals, refusals ---');
const ns = readCamt(`<?xml version="1.0"?><ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><ns2:BkToCstmrStmt><ns2:Stmt>
<ns2:Acct><ns2:Id><ns2:IBAN>DE11</ns2:IBAN></ns2:Id><ns2:Ccy>EUR</ns2:Ccy></ns2:Acct>
<ns2:Ntry><ns2:Amt Ccy="EUR">60.00</ns2:Amt><ns2:CdtDbtInd>DBIT</ns2:CdtDbtInd><ns2:BookgDt><ns2:Dt>2026-08-10</ns2:Dt></ns2:BookgDt><ns2:NtryDtls>
 <ns2:TxDtls><ns2:Refs><ns2:EndToEndId>A</ns2:EndToEndId></ns2:Refs><ns2:AmtDtls><ns2:TxAmt><ns2:Amt Ccy="EUR">10.00</ns2:Amt></ns2:TxAmt></ns2:AmtDtls><ns2:RltdPties><ns2:Cdtr><ns2:Nm>Alpha</ns2:Nm></ns2:Cdtr></ns2:RltdPties></ns2:TxDtls>
 <ns2:TxDtls><ns2:Refs><ns2:EndToEndId>B</ns2:EndToEndId></ns2:Refs><ns2:AmtDtls><ns2:TxAmt><ns2:Amt Ccy="EUR">50.00</ns2:Amt></ns2:TxAmt></ns2:AmtDtls><ns2:RltdPties><ns2:Cdtr><ns2:Nm>Beta</ns2:Nm></ns2:Cdtr></ns2:RltdPties></ns2:TxDtls>
</ns2:NtryDtls></ns2:Ntry>
<ns2:Ntry><ns2:Amt Ccy="EUR">15.00</ns2:Amt><ns2:CdtDbtInd>DBIT</ns2:CdtDbtInd><ns2:RvslInd>true</ns2:RvslInd><ns2:BookgDt><ns2:Dt>2026-08-12</ns2:Dt></ns2:BookgDt>
 <ns2:NtryDtls><ns2:TxDtls><ns2:RltdPties><ns2:Cdtr><ns2:Nm>Shop</ns2:Nm></ns2:Cdtr></ns2:RltdPties></ns2:TxDtls></ns2:NtryDtls></ns2:Ntry>
</ns2:Stmt></ns2:BkToCstmrStmt></ns2:Document>`);
// aqbanking cannot open a prefixed document at all; prefixes are stripped here.
eq('a namespace-prefixed document reads', ns.txns.length, 3);
eq('a batch entry expands to one row per detail, each with its own amount', ns.txns.slice(0, 2).map((t) => [t.counterparty, t.amount]), [['Alpha', '-10.00'], ['Beta', '-50.00']]);
eq('and says so', /1 batch booking/.test(ns.warnings.join(' ')), true);
eq('a reversed debit is money coming back', ns.txns[2].amount, '15.00');
eq('camt.052 reads through the same path', readCamt('<Document><BkToCstmrAcctRpt><Rpt><Acct><Id><IBAN>X</IBAN></Id></Acct><Ntry><Amt Ccy="EUR">1.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-01-01</Dt></BookgDt></Ntry></Rpt></BkToCstmrAcctRpt></Document>').txns.length, 1);
eq('not a camt file', /does not look like a camt/.test(readCamt('<OFX></OFX>').warnings[0]), true);
eq('not even XML', readCamt('date,amount').txns.length, 0);
eq('a CDATA purpose reads as text', parseXml('<a><![CDATA[x < y]]></a>')?.text, 'x < y');
eq('rows line up with headers', camtRowsOf(camt)[0].length, CAMT_HEADERS.length);

console.log(`\n${pass} passed, ${fail} failed\n`);
