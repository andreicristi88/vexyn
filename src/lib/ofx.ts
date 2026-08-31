/**
 * OFX / QBO generation. A .qbo file is OFX 1.0.2 SGML plus two Intuit tags, so
 * one builder serves both. The format has strict rules that, if broken, make
 * accounting software silently reject or mis-import the file — so the two
 * parsing steps here (date and amount) are deliberately explicit rather than
 * clever, and are unit-tested hard.
 *
 * OFX 1.x SGML quirk that matters: leaf tags are NOT closed (`<TRNAMT>-50.00`
 * with no closing tag); only aggregate tags are (`<STMTTRN>…</STMTTRN>`).
 */

export type DateFormat = 'iso' | 'us' | 'eu';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a date cell to 'YYYYMMDD'. `format` disambiguates numeric dates:
 *  - 'iso' : year first (2026-01-31, 2026/01/31)
 *  - 'us'  : month first (01/31/2026)
 *  - 'eu'  : day first (31/01/2026, 31.01.2026)
 * Also handles "05 Jan 2026" / "Jan 5, 2026" style regardless of format.
 * Returns null if it cannot parse — the caller must treat that as an error,
 * never as a guess.
 */
export function parseDateToYmd(input: string, format: DateFormat): string | null {
  const s = input.trim();
  if (!s) return null;

  // Month-name form, e.g. "5 Jan 2026", "Jan 5, 2026", "05-JAN-2026".
  const named = s.match(/(\d{1,2})[\s.\-/]*([A-Za-z]{3,})[\s.,\-/]*(\d{2,4})|([A-Za-z]{3,})[\s.\-/]*(\d{1,2})[\s.,\-/]*(\d{2,4})/);
  if (named) {
    let d: number, mo: number, y: number;
    if (named[1]) {
      d = +named[1]; mo = MONTHS[named[2].slice(0, 3).toLowerCase()]; y = +named[3];
    } else {
      mo = MONTHS[named[4].slice(0, 3).toLowerCase()]; d = +named[5]; y = +named[6];
    }
    if (mo) return assemble(y, mo, d);
  }

  // Numeric form. Strip any time component first ("2026-01-05 12:00:00").
  const dateOnly = s.split(/[ T]/)[0];
  const parts = dateOnly.split(/[\/.\-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null;

  let y: number, mo: number, d: number;
  if (format === 'iso') {
    [y, mo, d] = [+parts[0], +parts[1], +parts[2]];
  } else if (format === 'us') {
    [mo, d, y] = [+parts[0], +parts[1], +parts[2]];
  } else {
    [d, mo, y] = [+parts[0], +parts[1], +parts[2]];
  }
  // If the format was wrong but one component is unambiguous (a 4-digit year),
  // trust the 4-digit year position instead of the declared format.
  if (parts[0].length === 4) [y, mo, d] = [+parts[0], +parts[1], +parts[2]];

  return assemble(y, mo, d);
}

function assemble(y: number, mo: number, d: number): string | null {
  if (y < 100) y += y < 70 ? 2000 : 1900; // 2-digit year
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  return `${y}${String(mo).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/**
 * Parse an amount cell to a signed number. `decimal` says which character is
 * the decimal separator ('.' US, ',' EU) so "1.234,56" and "1,234.56" both
 * work. Parentheses and a trailing "DR" mean negative; "CR" means positive.
 * Returns null if no number is present.
 */
export function parseAmount(input: string, decimal: '.' | ','): number | null {
  let s = input.trim();
  if (!s) return null;

  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (/\bdr\b/i.test(s)) sign = -1;
  if (/\bcr\b/i.test(s)) sign = 1;

  // Keep digits, separators, and a leading/trailing minus.
  const hasMinus = /-/.test(s);
  let cleaned = s.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  if (decimal === ',') {
    // ',' is decimal, '.' is thousands.
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    // Any further commas were extra thousands groupings — drop them.
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // '.' is decimal, ',' is thousands.
    cleaned = cleaned.replace(/,/g, '');
  }

  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return (hasMinus ? -1 : 1) * sign * Math.abs(n);
}

export type OfxTxn = {
  datePosted: string; // YYYYMMDD
  amount: number; // signed; negative = debit
  name: string; // payee / description (OFX NAME, max 32 for strictness)
  memo?: string;
  fitid: string; // stable unique id
};

export type OfxAccount = {
  bankId: string;
  acctId: string;
  acctType: 'CHECKING' | 'SAVINGS' | 'CREDITLINE' | 'MONEYMRKT';
  currency: string; // e.g. USD, EUR, RON
};

export type OfxOptions = {
  qbo: boolean; // add Intuit tags + expect .qbo extension
  intuBid?: string; // Intuit Bank ID, QBO only
  org?: string; // FI org name
  fid?: string; // FI id
};

/** Escape the five XML/SGML entities in a leaf value. */
function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function amt(n: number): string {
  // OFX wants a plain decimal, dot separator, sign preserved.
  return n.toFixed(2);
}

/** Build a full OFX (or QBO) document from transactions + account info. */
export function buildOfx(txns: OfxTxn[], account: OfxAccount, opts: OfxOptions): string {
  const now = new Date();
  const dtServer =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;

  const dates = txns.map((t) => t.datePosted).filter(Boolean).sort();
  const dtStart = dates[0] ?? dtServer.slice(0, 8);
  const dtEnd = dates[dates.length - 1] ?? dtServer.slice(0, 8);

  const fiBlock =
    opts.org || opts.fid || opts.qbo
      ? `<FI>\n<ORG>${esc(opts.org ?? 'Vexyn')}\n<FID>${esc(opts.fid ?? '0000')}\n</FI>\n`
      : '';
  const intuBid = opts.qbo ? `<INTU.BID>${esc(opts.intuBid ?? '00000')}\n` : '';

  const txnBlocks = txns
    .map((t) => {
      const type = t.amount < 0 ? 'DEBIT' : 'CREDIT';
      return (
        `<STMTTRN>\n` +
        `<TRNTYPE>${type}\n` +
        `<DTPOSTED>${t.datePosted}\n` +
        `<TRNAMT>${amt(t.amount)}\n` +
        `<FITID>${esc(t.fitid)}\n` +
        `<NAME>${esc(t.name.slice(0, 32))}\n` +
        (t.memo ? `<MEMO>${esc(t.memo)}\n` : '') +
        `</STMTTRN>`
      );
    })
    .join('\n');

  const header =
    `OFXHEADER:100\n` +
    `DATA:OFXSGML\n` +
    `VERSION:102\n` +
    `SECURITY:NONE\n` +
    `ENCODING:USASCII\n` +
    `CHARSET:1252\n` +
    `COMPRESSION:NONE\n` +
    `OLDFILEUID:NONE\n` +
    `NEWFILEUID:NONE\n\n`;

  const body =
    `<OFX>\n` +
    `<SIGNONMSGSRSV1>\n<SONRS>\n<STATUS>\n<CODE>0\n<SEVERITY>INFO\n</STATUS>\n` +
    `<DTSERVER>${dtServer}\n<LANGUAGE>ENG\n${fiBlock}${intuBid}</SONRS>\n</SIGNONMSGSRSV1>\n` +
    `<BANKMSGSRSV1>\n<STMTTRNRS>\n<TRNUID>1\n<STATUS>\n<CODE>0\n<SEVERITY>INFO\n</STATUS>\n` +
    `<STMTRS>\n<CURDEF>${esc(account.currency)}\n` +
    `<BANKACCTFROM>\n<BANKID>${esc(account.bankId)}\n<ACCTID>${esc(account.acctId)}\n<ACCTTYPE>${account.acctType}\n</BANKACCTFROM>\n` +
    `<BANKTRANLIST>\n<DTSTART>${dtStart}\n<DTEND>${dtEnd}\n` +
    `${txnBlocks}\n` +
    `</BANKTRANLIST>\n` +
    `</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n`;

  return header + body;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export type ColumnMap = {
  date: number;
  amount: number;
  name: number;
  memo: number;
  fitid: number;
};

/**
 * Turn mapped CSV rows into OFX transactions. Rows whose date or amount cannot
 * be parsed are collected as errors rather than guessed — a wrong date in an
 * accounting import is worse than a skipped row the user is told about.
 */
export function rowsToTxns(
  rows: string[][],
  map: ColumnMap,
  dateFormat: DateFormat,
  decimal: '.' | ',',
): { txns: OfxTxn[]; errors: { row: number; reason: string }[] } {
  const txns: OfxTxn[] = [];
  const errors: { row: number; reason: string }[] = [];

  rows.forEach((row, i) => {
    const rawDate = map.date >= 0 ? row[map.date] ?? '' : '';
    const rawAmt = map.amount >= 0 ? row[map.amount] ?? '' : '';
    const dp = parseDateToYmd(rawDate, dateFormat);
    if (dp === null) {
      errors.push({ row: i + 1, reason: `could not read the date "${rawDate}"` });
      return;
    }
    const am = parseAmount(rawAmt, decimal);
    if (am === null) {
      errors.push({ row: i + 1, reason: `could not read the amount "${rawAmt}"` });
      return;
    }
    const name = (map.name >= 0 ? row[map.name] ?? '' : '').trim();
    const memo = (map.memo >= 0 ? row[map.memo] ?? '' : '').trim();
    const providedId = map.fitid >= 0 ? (row[map.fitid] ?? '').trim() : '';
    txns.push({
      datePosted: dp,
      amount: am,
      name: name || 'Transaction',
      memo: memo || undefined,
      fitid: providedId || makeFitid(dp, am, name, i),
    });
  });

  return { txns, errors };
}

/** Deterministic FITID from a transaction's own fields — stable across runs so
 *  re-importing the same file does not create duplicates. */
export function makeFitid(datePosted: string, amount: number, name: string, index: number): string {
  const base = `${datePosted}|${amount.toFixed(2)}|${name}|${index}`;
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
  return `${datePosted}${h.toString(16)}`;
}
