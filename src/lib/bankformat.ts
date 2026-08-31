/**
 * Reshape any bank's CSV export into one standard layout:
 *   Date (ISO YYYY-MM-DD) · Description · Amount (signed, dot decimal) · [Balance] · [Category]
 *
 * Reuses the tested date/amount parsers from ofx.ts. Unlike the OFX exporter,
 * which must drop rows it cannot parse, the formatter is forgiving: a value it
 * cannot normalize is passed through unchanged and counted as an issue, so no
 * data is lost and the user is told what to look at.
 */
import type { Grid } from './csv';
import { parseDateToYmd, parseAmount, type DateFormat } from './ofx';

export type FormatConfig = {
  date: number;
  description: number;
  balance: number;
  category: number;
  amountMode: 'single' | 'split';
  amount: number; // single signed column
  debit: number; // money out (positive in the source)
  credit: number; // money in (positive in the source)
  dateFormat: DateFormat;
  decimal: '.' | ',';
  flipSign: boolean; // single mode: source has money-out as positive
};

export type FormatResult = { grid: Grid; issues: number };

export function formatBankStatement(grid: Grid, cfg: FormatConfig): FormatResult {
  const headers = ['Date', 'Description', 'Amount'];
  if (cfg.balance >= 0) headers.push('Balance');
  if (cfg.category >= 0) headers.push('Category');

  let issues = 0;

  const rows = grid.rows.map((row) => {
    // Date -> ISO, or pass through if unparseable.
    const rawDate = cfg.date >= 0 ? row[cfg.date] ?? '' : '';
    const ymd = rawDate ? parseDateToYmd(rawDate, cfg.dateFormat) : null;
    let dateOut = rawDate;
    if (ymd) dateOut = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
    else if (rawDate) issues++;

    // Amount -> signed decimal.
    let amountOut = '';
    if (cfg.amountMode === 'single') {
      const raw = cfg.amount >= 0 ? row[cfg.amount] ?? '' : '';
      const n = raw ? parseAmount(raw, cfg.decimal) : null;
      if (n !== null) amountOut = (cfg.flipSign ? -n : n).toFixed(2);
      else { amountOut = raw; if (raw) issues++; }
    } else {
      // Separate columns: debit = out, credit = in. Result = credit - debit.
      const dRaw = cfg.debit >= 0 ? row[cfg.debit] ?? '' : '';
      const cRaw = cfg.credit >= 0 ? row[cfg.credit] ?? '' : '';
      const d = dRaw ? parseAmount(dRaw, cfg.decimal) : null;
      const c = cRaw ? parseAmount(cRaw, cfg.decimal) : null;
      if (d === null && c === null) {
        amountOut = '';
        if (dRaw || cRaw) issues++;
      } else {
        amountOut = ((c ?? 0) - Math.abs(d ?? 0)).toFixed(2);
      }
    }

    const out = [
      dateOut,
      cfg.description >= 0 ? row[cfg.description] ?? '' : '',
      amountOut,
    ];
    if (cfg.balance >= 0) {
      // Normalize Balance to the same dot-decimal format as Amount so the
      // output file has one consistent number format. Pass through on failure.
      const rawBal = row[cfg.balance] ?? '';
      const b = rawBal ? parseAmount(rawBal, cfg.decimal) : null;
      out.push(b !== null ? b.toFixed(2) : rawBal);
    }
    if (cfg.category >= 0) out.push(row[cfg.category] ?? '');
    return out;
  });

  return { grid: { headers, rows, delimiter: ',', hadBom: false }, issues };
}
