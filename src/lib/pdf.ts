/**
 * Turning a bank-statement PDF into rows.
 *
 * A PDF has no table: it has glyphs with coordinates. Extracting the text is
 * the easy half (pdf.js does it); the work here is rebuilding the table those
 * glyphs were laid out to look like. This module is deliberately pure — it
 * takes positioned text items and returns a Grid — so the reconstruction can
 * be tested without a browser or a real PDF. pdf.js is imported dynamically by
 * the component, the same way write-excel-file is.
 *
 * HOW IT DECIDES WHAT A ROW IS
 * A statement line that opens with a date starts a transaction; a line that
 * does not is either a continuation of the previous description (banks wrap
 * long merchant names) or page furniture — headers, totals, "Page 2 of 5".
 * Anchoring on the date is what keeps the furniture out without needing a
 * per-bank template.
 *
 * WHY AMOUNTS ARE PLACED BY COORDINATE, NOT BY ORDER
 * Statements with separate Debit and Credit columns leave one of them blank on
 * every row, so "the second number on the line" means different things on
 * different rows. Clustering the right-hand edge of every amount (they are
 * right-aligned, which is what makes this reliable) recovers the real columns
 * and leaves the blanks blank.
 *
 * WHAT IT DOES NOT DO
 * It does not guess which column is the amount, the balance, or the debit —
 * that mapping is the reader's, exposed in the UI like every other tool here.
 * A statement parser that silently puts a balance in the amount column is
 * worse than one that asks.
 */

import type { Grid } from './csv';

/** One positioned text run, normalized from a pdf.js TextItem. */
export type PdfTextItem = {
  str: string;
  /** Left edge, PDF units. */
  x: number;
  /** Baseline, PDF units. Larger is further up the page. */
  y: number;
  width: number;
};

/** Text runs merged into a visual line, in reading order. */
export type PdfLine = {
  page: number;
  y: number;
  tokens: PdfToken[];
  text: string;
};

export type PdfToken = { str: string; x: number; width: number; right: number };

export type ParseOptions = {
  /** Vertical slack when deciding two runs share a line. */
  yTolerance?: number;
  /** Horizontal gap below which two runs are one token. */
  gapTolerance?: number;
  /** Slack when clustering right edges into amount columns. */
  columnTolerance?: number;
  /**
   * Require a 1-2 digit decimal part before treating a number as money.
   * On by default: statement amounts carry cents, while reference numbers,
   * card fragments and document ids do not — this is the single rule that
   * keeps them out of the amount columns.
   */
  requireDecimals?: boolean;
  /** How far right of the description a wrapped line may start. */
  continuationMaxIndent?: number;
  /** How far below the previous line a wrapped line may sit. */
  continuationMaxGap?: number;
};

export type ParseResult = {
  grid: Grid;
  /** How many money columns were found, for labelling the mapping UI. */
  amountColumns: number;
  stats: {
    pages: number;
    lines: number;
    transactions: number;
    continuations: number;
    /** Lines that were neither a transaction nor a continuation. */
    ignored: number;
  };
  /** Every reconstructed line, so a failed parse can be inspected rather than guessed at. */
  lines: PdfLine[];
  warnings: string[];
};

/**
 * A date at the start of a line. Covers day-first, month-first, year-first and
 * month-name forms, with 2- or 4-digit years.
 */
const DATE_RE =
  /^(?:\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}\s+[a-z]{3,9}\.?\s+\d{2,4}|[a-z]{3,9}\.?\s+\d{1,2},?\s+\d{2,4})$/i;

/**
 * Money, with the shapes statements actually print: grouped thousands with dot,
 * comma, space or non-breaking space; a decimal part of one or two digits; a
 * leading or trailing minus; parentheses for negatives; a currency symbol; and
 * the CR/DR suffix some banks use instead of a sign.
 */
const AMOUNT_DEC_RE =
  /^[-(]?\s*[$£€]?\s*-?\d{1,3}(?:[.,  ]\d{3})*[.,]\d{1,2}\s*\)?\s*-?\s*(?:cr|dr)?$/i;
const AMOUNT_ANY_RE =
  /^[-(]?\s*[$£€]?\s*-?\d{1,3}(?:[.,  ]\d{3})*(?:[.,]\d{1,2})?\s*\)?\s*-?\s*(?:cr|dr)?$/i;

function amountRe(requireDecimals: boolean): RegExp {
  return requireDecimals ? AMOUNT_DEC_RE : AMOUNT_ANY_RE;
}

/** Is this token money? Bare integers are excluded unless decimals are optional. */
export function isAmount(s: string, requireDecimals = true): boolean {
  const t = s.trim();
  if (!t) return false;
  // A date must never be read as money: 31.01.2026 would otherwise look like
  // grouped thousands to a loose pattern.
  if (DATE_RE.test(t)) return false;
  return amountRe(requireDecimals).test(t);
}

export function isDate(s: string): boolean {
  return DATE_RE.test(s.trim());
}

/**
 * Group positioned runs into lines, then merge runs that sit side by side into
 * single tokens. pdf.js often splits one printed word across several runs, so
 * without the merge an amount can arrive as "1.234" + ",56".
 */
export function buildLines(pages: PdfTextItem[][], opts: ParseOptions = {}): PdfLine[] {
  const yTol = opts.yTolerance ?? 3;
  const gapTol = opts.gapTolerance ?? 1.5;
  const out: PdfLine[] = [];

  pages.forEach((items, pageIndex) => {
    const rows: { y: number; items: PdfTextItem[] }[] = [];
    for (const it of items) {
      if (!it.str || !it.str.trim()) continue;
      const row = rows.find((r) => Math.abs(r.y - it.y) <= yTol);
      if (row) row.items.push(it);
      else rows.push({ y: it.y, items: [it] });
    }
    // Down the page, then left to right — PDF y grows upward.
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      const tokens: PdfToken[] = [];
      for (const it of r.items) {
        const prev = tokens[tokens.length - 1];
        const gap = prev ? it.x - prev.right : Infinity;
        // Runs merge only when they sit flush. Kerning can make a run start a
        // hair before the previous one ends, but a large overlap means the two
        // are in different columns — merging those would glue the date onto the
        // description and the line would stop looking like a transaction.
        if (prev && gap <= gapTol && gap > -2) {
          prev.str += it.str;
          prev.right = it.x + it.width;
          prev.width = prev.right - prev.x;
        } else {
          tokens.push({ str: it.str, x: it.x, width: it.width, right: it.x + it.width });
        }
      }
      for (const t of tokens) t.str = t.str.trim();
      const kept = tokens.filter((t) => t.str);
      if (!kept.length) continue;
      out.push({
        page: pageIndex + 1,
        y: r.y,
        tokens: kept,
        text: kept.map((t) => t.str).join(' '),
      });
    }
  });

  return out;
}

/**
 * Which separator is the decimal point, decided from the amounts themselves
 * rather than assumed. Whichever of "." or "," is followed by exactly two
 * digits at the end of a number wins the majority vote.
 */
export function detectDecimal(lines: PdfLine[], requireDecimals = true): '.' | ',' {
  let dot = 0;
  let comma = 0;
  for (const line of lines) {
    for (const t of line.tokens) {
      if (!isAmount(t.str, requireDecimals)) continue;
      const m = t.str.match(/([.,])(\d{1,2})\s*\)?\s*-?\s*(?:cr|dr)?$/i);
      if (!m) continue;
      if (m[1] === '.') dot++;
      else comma++;
    }
  }
  return comma > dot ? ',' : '.';
}

/** Greedy clustering of right edges; each cluster becomes one amount column. */
function clusterRightEdges(edges: number[], tolerance: number): number[] {
  if (!edges.length) return [];
  const sorted = [...edges].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = clusters[clusters.length - 1];
    if (sorted[i] - last[last.length - 1] <= tolerance) last.push(sorted[i]);
    else clusters.push([sorted[i]]);
  }
  return clusters.map((c) => c.reduce((s, v) => s + v, 0) / c.length);
}

/**
 * Rebuild the transaction table.
 *
 * Returns a Grid shaped like every other tool's input — Date, Description and
 * one column per money column found — so the result flows straight into the
 * CSV download and the rest of the site.
 */
export function parseStatement(lines: PdfLine[], opts: ParseOptions = {}): ParseResult {
  const requireDecimals = opts.requireDecimals ?? true;
  const colTol = opts.columnTolerance ?? 8;
  const maxIndent = opts.continuationMaxIndent ?? 40;
  const maxGap = opts.continuationMaxGap ?? 30;
  const warnings: string[] = [];

  const isTxnLine = (l: PdfLine) => l.tokens.length > 0 && isDate(l.tokens[0].str);
  const txnLines = lines.filter(isTxnLine);

  if (!lines.length) {
    warnings.push(
      'No text was found in this PDF. It is most likely a scan or a photo, which needs OCR — this tool reads text-based statements only.',
    );
  } else if (!txnLines.length) {
    warnings.push(
      'Text was found, but no line began with a date, so no transactions could be identified. Check the extracted lines below — the date may be in a format this does not recognise yet.',
    );
  }

  // Amount columns, from the right edges of every money token on transaction
  // lines. Doing this across all rows is what lets a blank Debit or Credit stay
  // blank instead of shifting the row left.
  const edges: number[] = [];
  for (const l of txnLines) {
    for (const t of l.tokens) if (isAmount(t.str, requireDecimals)) edges.push(t.right);
  }
  const columns = clusterRightEdges(edges, colTol);

  const headers = ['Date', 'Description', ...columns.map((_, i) => `Amount ${i + 1}`)];
  const rows: string[][] = [];
  let continuations = 0;
  let ignored = 0;
  /** Where descriptions start, used to tell a wrapped description from a footer. */
  let descLeft = Infinity;
  /** The line the last row came from, so a wrapped line can be required to follow it. */
  let lastLine: PdfLine | null = null;

  for (const line of lines) {
    if (isTxnLine(line)) {
      const date = line.tokens[0].str;
      const amountTokens = line.tokens.filter((t) => isAmount(t.str, requireDecimals));
      const firstAmountX = amountTokens.length ? Math.min(...amountTokens.map((t) => t.x)) : Infinity;
      const descTokens = line.tokens
        .slice(1)
        .filter((t) => t.x < firstAmountX && !isAmount(t.str, requireDecimals));
      if (descTokens.length) descLeft = Math.min(descLeft, descTokens[0].x);

      const cells = new Array(columns.length).fill('');
      for (const t of amountTokens) {
        let best = 0;
        let bestD = Infinity;
        columns.forEach((c, i) => {
          const d = Math.abs(c - t.right);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        // Two amounts landing in one column means the clustering was too
        // coarse for this layout; keep both rather than dropping one silently.
        cells[best] = cells[best] ? `${cells[best]} ${t.str}` : t.str;
      }
      rows.push([date, descTokens.map((t) => t.str).join(' '), ...cells]);
      lastLine = line;
      continue;
    }

    // A wrapped description: no date, no money, starting in the description
    // column, and sitting immediately under the row it belongs to.
    //
    // The position checks are what keep page furniture out. A centred "Page 1
    // of 3" also has no date and no amount, so without an indent band it would
    // be glued onto the last transaction's description; without the vertical
    // check, a footer at the bottom of the page would be too.
    const last = rows[rows.length - 1];
    const hasAmount = line.tokens.some((t) => isAmount(t.str, requireDecimals));
    const left = line.tokens[0].x;
    const inDescBand = left >= descLeft - 2 && left <= descLeft + maxIndent;
    const follows = !!lastLine && lastLine.page === line.page && lastLine.y - line.y <= maxGap;
    if (last && !hasAmount && inDescBand && follows && Number.isFinite(descLeft)) {
      last[1] = last[1] ? `${last[1]} ${line.text}` : line.text;
      continuations++;
      lastLine = line;
    } else {
      ignored++;
    }
  }

  const doubled = rows.some((r) => r.slice(2).some((c) => c.includes(' ')));
  if (doubled) {
    warnings.push(
      'Two amounts landed in the same column on at least one row, which usually means the columns sit closer together than the tolerance allows. Check those rows before using the file.',
    );
  }

  return {
    grid: { headers, rows, delimiter: ',', hadBom: false },
    amountColumns: columns.length,
    stats: {
      pages: lines.length ? lines[lines.length - 1].page : 0,
      lines: lines.length,
      transactions: rows.length,
      continuations,
      ignored,
    },
    lines,
    warnings,
  };
}
