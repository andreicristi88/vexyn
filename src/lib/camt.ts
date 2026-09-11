/**
 * CAMT.053 — the ISO 20022 bank-to-customer statement, the XML successor to
 * MT940 and what most EU banks now hand a business that asks for a statement
 * for its accounting software. camt.052 (intraday) and camt.054 (debit/credit
 * notification) share the entry layout and read here as well.
 *
 * The parts that carry money, by path under BkToCstmrStmt/Stmt:
 *
 *   Acct/Id/IBAN, Acct/Ccy         the account and its currency
 *   Bal[Tp=OPBD], Bal[Tp=CLBD]     opening and closing balances
 *   Ntry                           one booking: Amt, CdtDbtInd, BookgDt,
 *                                  ValDt, AcctSvcrRef, BkTxCd
 *   Ntry/NtryDtls/TxDtls           the details: Refs (EndToEndId, MndtId),
 *                                  RltdPties (Dbtr/Cdtr/Nm), RmtInf/Ustrd
 *
 * The counterparty depends on direction: money going out (DBIT) names the
 * creditor, money coming in (CRDT) names the debtor. Amounts are ISO decimals
 * already, so they are taken as written and only signed.
 *
 * A batch booking — one Ntry holding several TxDtls with their own amounts —
 * is expanded to one row per detail, because that is what the bookkeeper has
 * to match, and a warning says how many entries were expanded.
 *
 * Checked against the aqbanking camt importer that ships with GnuCash.
 */

// --- a minimal XML reader: enough for ISO 20022, no dependencies --------------

export type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string };

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Strip a namespace prefix: "ns2:Ntry" → "Ntry". */
const local = (n: string) => n.slice(n.lastIndexOf(':') + 1);

export function parseXml(xml: string): XmlNode | null {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  // Prolog, comments and CDATA are not part of what banks send; comments and
  // the prolog are skipped, CDATA is read as text.
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s\/>]+)((?:\s+[^\s=\/>]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) {
      if (stack.length > 1) stack.pop();
    } else if (m[3]) {
      const attrs: Record<string, string> = {};
      for (const a of m[4].matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/g)) attrs[local(a[1])] = decode(a[2]);
      const node: XmlNode = { name: local(m[3]), attrs, children: [], text: '' };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined && m[6].trim()) top.text += decode(m[6]);
  }
  return root.children[0] ?? null;
}

const child = (n: XmlNode | undefined, name: string) => n?.children.find((c) => c.name === name);
const kids = (n: XmlNode | undefined, name: string) => n?.children.filter((c) => c.name === name) ?? [];
/** Follow a path of element names; undefined if any step is missing. */
function at(n: XmlNode | undefined, ...path: string[]): XmlNode | undefined {
  let cur = n;
  for (const p of path) {
    cur = child(cur, p);
    if (!cur) return undefined;
  }
  return cur;
}
const textAt = (n: XmlNode | undefined, ...path: string[]) => (at(n, ...path)?.text ?? '').trim();

// --- the statement --------------------------------------------------------------

export type CamtTxn = {
  date: string; // booking date, YYYY-MM-DD
  valueDate: string;
  amount: string; // signed, as the file wrote it
  currency: string;
  counterparty: string;
  counterpartyIban: string;
  purpose: string;
  bankRef: string; // AcctSvcrRef
  e2eRef: string;
  mandateId: string;
  code: string; // BkTxCd domain/family/subfamily, e.g. PMNT/ICDT/ESCT
  status: string; // BOOK, PDNG
  info: string; // AddtlNtryInf — the bank's own one-line description
  account: string;
};

export type CamtResult = {
  txns: CamtTxn[];
  accounts: { account: string; currency: string; opening: string; closing: string }[];
  warnings: string[];
};

/** A date element is either <Dt>YYYY-MM-DD</Dt> or <DtTm>YYYY-MM-DDThh:mm:ss</DtTm>. */
function dateOf(n: XmlNode | undefined): string {
  const d = textAt(n, 'Dt') || textAt(n, 'DtTm');
  return d.slice(0, 10);
}

function balance(stmt: XmlNode, code: string): string {
  for (const b of kids(stmt, 'Bal')) {
    if (textAt(b, 'Tp', 'CdOrPrtry', 'Cd') !== code) continue;
    const amt = textAt(b, 'Amt');
    return (textAt(b, 'CdtDbtInd') === 'DBIT' ? '-' : '') + amt;
  }
  return '';
}

function txCode(n: XmlNode | undefined): string {
  const d = at(n, 'BkTxCd', 'Domn');
  if (!d) return textAt(n, 'BkTxCd', 'Prtry', 'Cd');
  return [textAt(d, 'Cd'), textAt(d, 'Fmly', 'Cd'), textAt(d, 'Fmly', 'SubFmlyCd')].filter(Boolean).join('/');
}

export function readCamt(xml: string): CamtResult {
  const warnings: string[] = [];
  const txns: CamtTxn[] = [];
  const accounts: CamtResult['accounts'] = [];

  const doc = parseXml(xml);
  const body =
    child(doc ?? undefined, 'BkToCstmrStmt') ?? child(doc ?? undefined, 'BkToCstmrAcctRpt') ?? child(doc ?? undefined, 'BkToCstmrDbtCdtNtfctn');
  if (!doc || !body) {
    return { txns, accounts, warnings: ['No BkToCstmrStmt element — this does not look like a camt.053 (or camt.052/054) file.'] };
  }
  const stmts = [...kids(body, 'Stmt'), ...kids(body, 'Rpt'), ...kids(body, 'Ntfctn')];
  let expanded = 0;

  for (const stmt of stmts) {
    const account = textAt(stmt, 'Acct', 'Id', 'IBAN') || textAt(stmt, 'Acct', 'Id', 'Othr', 'Id');
    const stmtCcy = textAt(stmt, 'Acct', 'Ccy');
    if (account && !accounts.some((a) => a.account === account)) {
      accounts.push({ account, currency: stmtCcy, opening: balance(stmt, 'OPBD'), closing: balance(stmt, 'CLBD') });
    }

    for (const ntry of kids(stmt, 'Ntry')) {
      const amtNode = child(ntry, 'Amt');
      const entryAmt = (amtNode?.text ?? '').trim();
      const currency = amtNode?.attrs.Ccy || stmtCcy;
      const dbit = textAt(ntry, 'CdtDbtInd') === 'DBIT';
      // A reversal flips the direction: a reversed debit is money coming back.
      const reversed = textAt(ntry, 'RvslInd') === 'true';
      const sign = dbit !== reversed ? '-' : '';
      const base = {
        date: dateOf(child(ntry, 'BookgDt')),
        valueDate: dateOf(child(ntry, 'ValDt')),
        currency,
        bankRef: textAt(ntry, 'AcctSvcrRef'),
        code: txCode(ntry),
        status: textAt(ntry, 'Sts') || textAt(ntry, 'Sts', 'Cd'),
        info: textAt(ntry, 'AddtlNtryInf'),
        account,
      };

      const details = kids(child(ntry, 'NtryDtls'), 'TxDtls');
      const withOwnAmount = details.filter((d) => textAt(d, 'AmtDtls', 'TxAmt', 'Amt'));
      const rows = withOwnAmount.length > 1 ? withOwnAmount : [details[0]];
      if (withOwnAmount.length > 1) expanded++;

      for (const tx of rows) {
        const own = textAt(tx, 'AmtDtls', 'TxAmt', 'Amt');
        const parties = child(tx, 'RltdPties');
        // The other side of the money: creditor when it went out, debtor when it came in.
        const other = dbit ? 'Cdtr' : 'Dbtr';
        const cp = child(parties, other);
        const cpName = textAt(cp, 'Nm') || textAt(cp, 'Pty', 'Nm');
        const cpIban = textAt(parties, `${other}Acct`, 'Id', 'IBAN');
        const ustrd = kids(child(tx, 'RmtInf'), 'Ustrd').map((u) => u.text.trim()).filter(Boolean).join(' ');
        const strd = textAt(tx, 'RmtInf', 'Strd', 'CdtrRefInf', 'Ref');
        txns.push({
          ...base,
          amount: sign + (own || entryAmt),
          counterparty: cpName,
          counterpartyIban: cpIban,
          purpose: ustrd || strd,
          e2eRef: textAt(tx, 'Refs', 'EndToEndId').replace(/^NOTPROVIDED$/i, ''),
          mandateId: textAt(tx, 'Refs', 'MndtId'),
        });
      }
    }
  }

  if (txns.length === 0) warnings.push('No entries found. The file parsed, but it carries no <Ntry> elements.');
  if (expanded) warnings.push(`${expanded} batch booking(s) were expanded to one row per transaction, using each transaction's own amount.`);
  return { txns, accounts, warnings };
}

export const CAMT_HEADERS = [
  'Date', 'Value date', 'Amount', 'Currency', 'Counterparty', 'Counterparty IBAN', 'Purpose',
  'Bank reference', 'End-to-end ref', 'Mandate', 'Code', 'Status', 'Bank description', 'Account',
];

export function camtRowsOf(r: CamtResult): string[][] {
  return r.txns.map((t) => [
    t.date, t.valueDate, t.amount, t.currency, t.counterparty, t.counterpartyIban, t.purpose,
    t.bankRef, t.e2eRef, t.mandateId, t.code, t.status, t.info, t.account,
  ]);
}
