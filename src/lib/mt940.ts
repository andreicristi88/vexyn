/**
 * MT940 — the SWIFT customer statement message. What a European business gets
 * from its bank when it asks for a statement "for the accounting software".
 *
 * A message is a sequence of tagged fields, `:NN:` at the start of a line, each
 * possibly continued on following lines. The ones that carry money:
 *
 *   :25:  account
 *   :60F: opening balance — and the only place the currency is stated
 *   :61:  one transaction line: value date, entry date, D/C, amount, code, refs
 *   :86:  the details for the :61: just above — bank-specific, free text or
 *         German-style ?NN subfields carrying payee, purpose and SEPA references
 *   :62F: closing balance
 *
 * Amounts use a comma decimal by definition of the format, so turning
 * "42,00" into "42.00" here is reading the spec, not guessing at a locale —
 * the one place on this site where a comma is rewritten.
 *
 * Checked against the aqbanking SWIFT importer that ships with GnuCash: the
 * same fixtures go through both, and dates, amounts, payee, purpose and
 * references agree.
 */

export type Mt940Txn = {
  date: string; // value date, YYYY-MM-DD
  entryDate: string; // booking date, YYYY-MM-DD, or '' when the bank omits it
  amount: string; // signed, dot decimal
  currency: string;
  payee: string;
  purpose: string;
  txnText: string; // ?00 — "SEPA-LASTSCHRIFT", "CARD PAYMENT"…
  code: string; // the three letters after N/F/S in :61: — TRF, MSC, CHG…
  reference: string; // customer reference, the part before //
  bankRef: string; // the part after //
  e2eRef: string; // SEPA EREF+
  detail: string; // the :86: field as the bank wrote it, for when the split above is not enough
  account: string;
};

export type Mt940Result = {
  txns: Mt940Txn[];
  accounts: { account: string; currency: string; opening: string; closing: string }[];
  warnings: string[];
};

/** YYMMDD → YYYY-MM-DD. SWIFT dates are two-digit years; 20xx is the only sane read now. */
function ymd(yymmdd: string): string {
  return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

/** "1234,56" → "1234.56"; a trailing comma ("42,") means a whole number. */
function amt(s: string): string {
  const [int, frac = ''] = s.split(',');
  return `${int}.${(frac + '00').slice(0, 2)}`;
}

/**
 * The :61: line. Grammar, from the SWIFT user handbook:
 *   6!n[4!n]2a[1!a]15d1!a3!c16x[//16x][CRLF 34x]
 * = value date, entry date (MMDD), D/C/RC/RD, funds code letter, amount,
 *   N|F|S + 3-char code, customer reference, //bank reference, supplement.
 */
const TAG61 =
  /^(\d{6})(\d{4})?(RC|RD|C|D)([A-Z])?(\d+,\d*)([NFS])([A-Z0-9]{3})(.*)$/s;

/**
 * Split a structured :86: into its ?NN subfields. Returns null for free text,
 * which is what Dutch, Belgian and most non-German banks send.
 */
function subfields(text: string): Map<string, string[]> | null {
  // The German form opens with a three-digit business transaction code and
  // then ?00. aqbanking requires that prefix too; "?20" loose in free text is
  // not enough to call the field structured.
  if (!/^\d{3}\?\d\d/.test(text)) return null;
  const out = new Map<string, string[]>();
  const re = /\?(\d\d)([^?]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1];
    const list = out.get(key) ?? [];
    list.push(m[2]);
    out.set(key, list);
  }
  return out;
}

/**
 * SEPA purpose text packs several tagged values into the ?20–?29 lines:
 * EREF+ end-to-end reference, MREF+ mandate, CRED+ creditor id, SVWZ+ the
 * actual purpose, ABWA+ ultimate creditor. Pull the two that matter and leave
 * the rest of the text as the purpose when there is no SVWZ+.
 */
function sepa(purpose: string): { purpose: string; e2eRef: string } {
  const tagged = purpose.match(/(EREF|MREF|CRED|SVWZ|ABWA|ABWE|KREF|IBAN|BIC|COAM|OAMT|DEBT|PURP)\+/g);
  if (!tagged) return { purpose: purpose.trim(), e2eRef: '' };
  const parts = purpose.split(/(?=(?:EREF|MREF|CRED|SVWZ|ABWA|ABWE|KREF|IBAN|BIC|COAM|OAMT|DEBT|PURP)\+)/);
  let svwz = '';
  let e2e = '';
  const untagged: string[] = [];
  for (const p of parts) {
    const m = p.match(/^([A-Z]{3,4})\+(.*)$/s);
    if (!m) {
      if (p.trim()) untagged.push(p.trim());
      continue;
    }
    if (m[1] === 'SVWZ') svwz = m[2].trim();
    else if (m[1] === 'EREF') e2e = m[2].trim();
  }
  return { purpose: svwz || untagged.join(' ').trim(), e2eRef: e2e };
}

/**
 * The Dutch form: ABN AMRO, ING and Rabobank write :86: as /TAG/value/ pairs —
 * /TRTP/SEPA OVERBOEKING/IBAN/…/NAME/J DE VRIES/REMI/Terugbetaling/EREF/…
 * aqbanking leaves this as one string with an empty payee. The tags are
 * documented, so they are read; the raw text is kept alongside.
 */
function dutch(detail: string): { payee: string; purpose: string; e2eRef: string } | null {
  if (!/^\/[A-Z]{3,4}\//.test(detail)) return null;
  const tags = new Map<string, string>();
  const re = /\/([A-Z]{3,4})\/((?:(?!\/[A-Z]{3,4}\/).)*)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(detail)) !== null) tags.set(m[1], m[2].trim());
  const eref = tags.get('EREF') ?? '';
  return {
    payee: tags.get('NAME') ?? '',
    purpose: tags.get('REMI') ?? '',
    e2eRef: /^NOTPROVIDED$/i.test(eref) ? '' : eref,
  };
}

export function readMt940(text: string): Mt940Result {
  const warnings: string[] = [];
  const txns: Mt940Txn[] = [];
  const accounts: Mt940Result['accounts'] = [];

  // Some banks wrap the message in SWIFT blocks — {1:…}{2:…}{4:\n:20:…\n-}.
  // Only block 4 holds fields.
  let body = text.replace(/\r\n?/g, '\n');
  const b4 = body.indexOf('{4:');
  if (b4 >= 0) body = body.slice(b4 + 3);

  if (!/^:20:/m.test(body)) {
    return { txns, accounts, warnings: ['No :20: field — this does not look like an MT940 statement.'] };
  }

  // Fold continuation lines into their field, then walk the fields in order.
  // A line that starts with ":NN" opens a field; anything else continues it.
  // A lone "-" ends a message and resets nothing we rely on.
  //
  // Trailing spaces are kept. A field wraps as a hard cut at 65 characters,
  // and when the 65th is a space, stripping it welds the words either side of
  // the break — "J DE " + "VRIES" came back as "J DEVRIES". A line is blank
  // or the terminator by its trimmed form only.
  const fields: { tag: string; value: string }[] = [];
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (t === '-' || t === '') continue;
    const m = line.match(/^:(\d\d[A-Z]?):(.*)$/);
    if (m) fields.push({ tag: m[1], value: m[2] });
    else if (fields.length) fields[fields.length - 1].value += '\n' + line;
  }

  let account = '';
  let currency = '';
  let opening = '';
  let pending: Mt940Txn | null = null;
  let unmatched86 = 0;

  const flush = () => {
    if (pending) txns.push(pending);
    pending = null;
  };

  for (const { tag, value } of fields) {
    switch (tag) {
      case '20':
        flush();
        break;
      case '25':
        flush();
        account = value.trim();
        break;
      case '60F':
      case '60M': {
        // C260901EUR1234,56 — D/C, YYMMDD, currency, amount
        const m = value.trim().match(/^(C|D)(\d{6})([A-Z]{3})(\d+,\d*)$/);
        if (m) {
          currency = m[3];
          if (tag === '60F') opening = (m[1] === 'D' ? '-' : '') + amt(m[4]);
        }
        break;
      }
      case '62F':
      case '62M': {
        const m = value.trim().match(/^(C|D)(\d{6})([A-Z]{3})(\d+,\d*)$/);
        if (m && tag === '62F') {
          flush();
          const closing = (m[1] === 'D' ? '-' : '') + amt(m[4]);
          if (account && !accounts.some((a) => a.account === account)) {
            accounts.push({ account, currency: currency || m[3], opening, closing });
          }
        }
        break;
      }
      case '61': {
        flush();
        const [first, ...supplement] = value.split('\n');
        const m = first.trim().match(TAG61);
        if (!m) {
          warnings.push(`Could not read a transaction line: ":61:${first.trim().slice(0, 40)}" — that entry is skipped.`);
          break;
        }
        const [, vdate, edate, dc, , amount, , code, refs] = m;
        const sign = dc === 'D' || dc === 'RC' ? '-' : '';
        const [custRef, bankRef = ''] = refs.split('//');
        pending = {
          date: ymd(vdate),
          entryDate: edate ? `${ymd(vdate).slice(0, 4)}-${edate.slice(0, 2)}-${edate.slice(2, 4)}` : '',
          amount: sign + amt(amount),
          currency,
          payee: '',
          purpose: supplement.join(' ').trim(),
          txnText: '',
          code,
          reference: custRef.trim() === 'NONREF' ? '' : custRef.trim(),
          bankRef: bankRef.trim(),
          e2eRef: '',
          detail: supplement.join(' ').trim(),
          account,
        };
        break;
      }
      case '86': {
        if (!pending) {
          unmatched86++;
          break;
        }
        const flat = value.replace(/\n/g, '');
        // Everything the bank wrote, untouched, next to whatever is split out
        // of it below. The :61: supplement line is already in here.
        pending.detail = [pending.detail, flat.trim()].filter(Boolean).join(' ');
        const sf = subfields(flat);
        const nl = sf ? null : dutch(flat);
        if (sf) {
          // German structured form. The three-digit GVC code before the first
          // ?00 names the business transaction; ?00 is its text.
          pending.txnText = (sf.get('00') ?? []).join(' ').trim();
          // ?32 and ?33 are one name cut at 27 characters, sometimes mid-word,
          // so they join with nothing between them — as aqbanking does.
          pending.payee = [...(sf.get('32') ?? []), ...(sf.get('33') ?? [])].join('').trim();
          const purposeLines = [...'0123456789'].flatMap((d) => sf.get('2' + d) ?? []);
          const extra = ['60', '61', '62', '63'].flatMap((k) => sf.get(k) ?? []);
          const { purpose, e2eRef } = sepa([...purposeLines, ...extra].join(''));
          pending.purpose = purpose;
          pending.e2eRef = e2eRef;
        } else if (nl) {
          // Dutch /TAG/ form: NAME is the payee, REMI the purpose. When there
          // is no REMI the whole field stays as the purpose, so nothing is lost.
          pending.payee = nl.payee;
          pending.purpose = [pending.purpose, nl.purpose || flat].filter(Boolean).join(' ').trim();
          pending.e2eRef = nl.e2eRef;
        } else {
          // Free text: the whole field is the purpose, with any SEPA tags
          // still pulled out of it.
          const { purpose, e2eRef } = sepa(value.replace(/\n/g, ' '));
          pending.purpose = [pending.purpose, purpose].filter(Boolean).join(' ').trim();
          pending.e2eRef = e2eRef;
        }
        break;
      }
    }
  }
  flush();

  // A statement with :61: lines but no :62F: still names its account.
  if (account && !accounts.some((a) => a.account === account)) {
    accounts.push({ account, currency, opening, closing: '' });
  }

  if (txns.length === 0) warnings.push('No transactions found. The file parsed, but it carries no :61: entries.');
  if (unmatched86) warnings.push(`${unmatched86} detail field(s) (:86:) had no transaction line before them and were ignored.`);
  if (!currency) warnings.push('No opening balance (:60F:) found, so the currency is unknown.');

  return { txns, accounts, warnings };
}

export const MT940_HEADERS = [
  'Date', 'Entry date', 'Amount', 'Currency', 'Payee', 'Purpose', 'Type', 'Code',
  'Reference', 'Bank reference', 'End-to-end ref', 'Details', 'Account',
];

export function mt940RowsOf(r: Mt940Result): string[][] {
  return r.txns.map((t) => [
    t.date, t.entryDate, t.amount, t.currency, t.payee, t.purpose, t.txnText, t.code,
    t.reference, t.bankRef, t.e2eRef, t.detail, t.account,
  ]);
}
