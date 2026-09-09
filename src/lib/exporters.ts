/**
 * Multi-format transaction exporters, shared across the Business Finance tools.
 * Every reconciliation / analysis output can be handed to whatever accounting
 * software the user runs, so each tool shows one download button per format.
 *
 * Input is a normalized, already-parsed transaction (date is ISO YYYY-MM-DD,
 * amount is a signed number). Text formats live here; the .xlsx export is done
 * in the component (write-excel-file is browser-only), and OFX/QBO stay in the
 * dedicated CSV→OFX/QBO tools because they need account identifiers.
 */

import { serializeCsv, type Grid } from './csv';

export type ExportTxn = {
  date: string; // ISO YYYY-MM-DD
  amount: number; // signed: negative = money out
  description: string;
};

function grid(headers: string[], rows: string[][]): Grid {
  return { headers, rows, delimiter: ',', hadBom: false };
}

function money(n: number): string {
  return n.toFixed(2);
}

/** ISO YYYY-MM-DD → MM/DD/YYYY (classic QIF / some importers). */
function toUsDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

/** Generic, signed single-amount CSV: Date, Description, Amount. */
export function toGenericCsv(txns: ExportTxn[]): string {
  return serializeCsv(
    grid(['Date', 'Description', 'Amount'], txns.map((t) => [t.date, t.description, money(t.amount)])),
    ',',
  );
}

/** QuickBooks-style 4-column CSV: Date, Description, Credit (in), Debit (out). */
export function toQuickBooksCsv(txns: ExportTxn[]): string {
  return serializeCsv(
    grid(
      ['Date', 'Description', 'Credit', 'Debit'],
      txns.map((t) => [
        t.date,
        t.description,
        t.amount >= 0 ? money(t.amount) : '',
        t.amount < 0 ? money(-t.amount) : '',
      ]),
    ),
    ',',
  );
}

/** Xero bank-statement CSV: Date, Amount (signed), Payee, Description. */
export function toXeroCsv(txns: ExportTxn[]): string {
  return serializeCsv(
    grid(
      ['Date', 'Amount', 'Payee', 'Description'],
      txns.map((t) => [t.date, money(t.amount), t.description, t.description]),
    ),
    ',',
  );
}

/** QIF (Quicken / GnuCash / many others). Dates as MM/DD/YYYY. */
export function toQif(txns: ExportTxn[]): string {
  const lines = ['!Type:Bank'];
  for (const t of txns) {
    lines.push(`D${toUsDate(t.date)}`);
    lines.push(`T${money(t.amount)}`);
    if (t.description) lines.push(`P${t.description}`);
    lines.push('^');
  }
  return lines.join('\r\n') + '\r\n';
}

/** JSON array of records, values kept as-is. */
export function toJson(txns: ExportTxn[]): string {
  return JSON.stringify(
    txns.map((t) => ({ date: t.date, description: t.description, amount: t.amount })),
    null,
    2,
  );
}

/**
 * QIF declares no date order of its own, so every importer has to assume one —
 * and 09/01/2026 is a valid date under both, two months apart. GnuCash asks;
 * Quicken assumes month first. The file cannot say which order it used, so the
 * page does. Kept here rather than in each tool so the five copies of it cannot
 * drift into saying different things.
 */
export const QIF_DATE_NOTE = 'QIF has no way to state its date order, so ours are written month/day/year — pick that if your software asks.';

export type ExportFormat = {
  id: string;
  label: string;
  ext: string;
  mime: string;
  build: (txns: ExportTxn[]) => string;
  /** true = prepend a UTF-8 BOM (spreadsheets), false = plain */
  bom: boolean;
};

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'csv', label: 'Generic CSV', ext: 'csv', mime: 'text/csv;charset=utf-8', build: toGenericCsv, bom: true },
  { id: 'quickbooks', label: 'QuickBooks CSV', ext: 'csv', mime: 'text/csv;charset=utf-8', build: toQuickBooksCsv, bom: true },
  { id: 'xero', label: 'Xero CSV', ext: 'csv', mime: 'text/csv;charset=utf-8', build: toXeroCsv, bom: true },
  { id: 'qif', label: 'QIF (Quicken / GnuCash)', ext: 'qif', mime: 'application/qif', build: toQif, bom: false },
  { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json', build: toJson, bom: false },
];
