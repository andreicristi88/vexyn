/**
 * The shared CSV engine. Every finance tool on Vexyn parses, cleans, and
 * serializes tabular data through these pure functions — the CSV Cleaner is
 * just the first face of it. Keep this file free of DOM and UI concerns so it
 * can run in a worker or a test as easily as in a Svelte component.
 *
 * Parsing is delegated to PapaParse because hand-rolled CSV parsing gets the
 * hard cases wrong: quoted fields with embedded commas and newlines, escaped
 * quotes, BOM, mixed line endings, and delimiter detection. PapaParse handles
 * all of them and is battle-tested.
 */
import Papa from 'papaparse';

export type Grid = {
  /** Column headers, in order. Always present; synthesized if the file had none. */
  headers: string[];
  /** Data rows as arrays aligned to `headers`. Ragged rows are padded/truncated. */
  rows: string[][];
  /** The delimiter PapaParse detected (',', ';', '\t', '|'). */
  delimiter: string;
  /** True if a UTF-8 BOM was stripped from the input. */
  hadBom: boolean;
};

export type ParseResult =
  | { ok: true; grid: Grid; warnings: string[] }
  | { ok: false; error: string };

const KNOWN_DELIMITERS = [',', ';', '\t', '|'];

/**
 * Parse a raw CSV/TSV string into a rectangular grid. The first row is treated
 * as the header unless `hasHeader` is false, in which case columns are named
 * Column 1..N.
 */
export function parseCsv(input: string, hasHeader = true): ParseResult {
  if (!input || !input.trim()) {
    return { ok: false, error: 'The file is empty.' };
  }

  const hadBom = input.charCodeAt(0) === 0xfeff;
  const text = hadBom ? input.slice(1) : input;

  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
    delimitersToGuess: KNOWN_DELIMITERS,
    // Keep everything as strings — finance data must not be silently coerced
    // (leading zeros in account numbers, "00123", would be destroyed).
    dynamicTyping: false,
  });

  const data = (result.data as unknown[]).filter(Array.isArray) as string[][];
  if (data.length === 0) {
    return { ok: false, error: 'No rows could be read from this file.' };
  }

  const delimiter = result.meta.delimiter || ',';
  const warnings: string[] = [];

  // Papa surfaces malformed-field warnings; keep the useful ones, drop noise.
  for (const err of result.errors.slice(0, 5)) {
    if (err.type !== 'FieldMismatch') {
      warnings.push(`Row ${(err.row ?? 0) + 1}: ${err.message}`);
    }
  }

  let headers: string[];
  let bodyRows: string[][];

  if (hasHeader) {
    headers = (data[0] ?? []).map((h, i) => (h?.trim() ? h.trim() : `Column ${i + 1}`));
    bodyRows = data.slice(1);
  } else {
    const width = Math.max(...data.map((r) => r.length));
    headers = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
    bodyRows = data;
  }

  const colCount = headers.length;

  // Normalize every row to the header width so downstream code can index safely.
  const rows = bodyRows.map((r) => {
    if (r.length === colCount) return r.map(cell);
    if (r.length < colCount) {
      const padded = r.map(cell);
      while (padded.length < colCount) padded.push('');
      return padded;
    }
    warnings.push(`A row had ${r.length} fields; extra columns were dropped.`);
    return r.slice(0, colCount).map(cell);
  });

  // Drop trailing fully-empty rows — the near-universal artifact of a file
  // that ends in a newline. Empty rows in the middle are kept (they can be
  // meaningful separators); only the trailing ones go.
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === '')) rows.pop();

  return {
    ok: true,
    grid: { headers, rows, delimiter, hadBom },
    warnings: dedupeWarnings(warnings),
  };
}

function cell(v: unknown): string {
  return v == null ? '' : String(v);
}

function dedupeWarnings(w: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const msg of w) {
    // Collapse "a row had N fields" repeats into one line.
    const key = msg.replace(/\d+/g, '#');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(msg);
    }
  }
  return out;
}

export type CleanOptions = {
  /** Trim leading/trailing whitespace from every cell. */
  trimCells: boolean;
  /** Collapse runs of internal whitespace in a cell to a single space. */
  collapseSpaces: boolean;
  /** Drop rows where every cell is empty. */
  removeEmptyRows: boolean;
  /** Drop columns where every data cell is empty. */
  removeEmptyColumns: boolean;
  /** Drop rows that are exact duplicates of an earlier row. */
  removeDuplicateRows: boolean;
  /** Trim headers, collapse spaces, and make duplicate header names unique. */
  cleanHeaders: boolean;
};

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  trimCells: true,
  collapseSpaces: false,
  removeEmptyRows: true,
  removeEmptyColumns: false,
  removeDuplicateRows: false,
  cleanHeaders: true,
};

export type CleanStats = {
  cellsTrimmed: number;
  emptyRowsRemoved: number;
  emptyColumnsRemoved: number;
  duplicateRowsRemoved: number;
  headersRenamed: number;
};

export type CleanResult = { grid: Grid; stats: CleanStats };

/** Apply the selected cleaning operations to a grid. Pure — returns a new grid. */
export function cleanGrid(grid: Grid, opts: CleanOptions): CleanResult {
  const stats: CleanStats = {
    cellsTrimmed: 0,
    emptyRowsRemoved: 0,
    emptyColumnsRemoved: 0,
    duplicateRowsRemoved: 0,
    headersRenamed: 0,
  };

  let headers = [...grid.headers];
  let rows = grid.rows.map((r) => [...r]);

  // 1. Cell-level whitespace.
  if (opts.trimCells || opts.collapseSpaces) {
    rows = rows.map((row) =>
      row.map((c) => {
        let v = c;
        if (opts.trimCells) {
          const t = v.trim();
          if (t !== v) stats.cellsTrimmed++;
          v = t;
        }
        if (opts.collapseSpaces) v = v.replace(/\s{2,}/g, ' ');
        return v;
      }),
    );
  }

  // 2. Headers: trim, collapse, and de-duplicate names.
  if (opts.cleanHeaders) {
    const seen = new Map<string, number>();
    headers = headers.map((h, i) => {
      let name = h.trim().replace(/\s{2,}/g, ' ');
      if (!name) name = `Column ${i + 1}`;
      const lower = name.toLowerCase();
      if (seen.has(lower)) {
        const n = seen.get(lower)! + 1;
        seen.set(lower, n);
        name = `${name} (${n})`;
      } else {
        seen.set(lower, 1);
      }
      // Count each changed header once, whether it was trimmed or de-duplicated.
      if (name !== h) stats.headersRenamed++;
      return name;
    });
  }

  // 3. Remove empty columns (all data cells blank).
  if (opts.removeEmptyColumns) {
    const keep: number[] = [];
    for (let c = 0; c < headers.length; c++) {
      const anyValue = rows.some((row) => (row[c] ?? '').trim() !== '');
      if (anyValue) keep.push(c);
      else stats.emptyColumnsRemoved++;
    }
    if (stats.emptyColumnsRemoved > 0) {
      headers = keep.map((c) => headers[c]);
      rows = rows.map((row) => keep.map((c) => row[c] ?? ''));
    }
  }

  // 4. Remove fully empty rows.
  if (opts.removeEmptyRows) {
    const before = rows.length;
    rows = rows.filter((row) => row.some((c) => (c ?? '').trim() !== ''));
    stats.emptyRowsRemoved = before - rows.length;
  }

  // 5. Remove exact duplicate rows (keep first occurrence).
  if (opts.removeDuplicateRows) {
    const seen = new Set<string>();
    const before = rows.length;
    rows = rows.filter((row) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    stats.duplicateRowsRemoved = before - rows.length;
  }

  return { grid: { ...grid, headers, rows }, stats };
}

/**
 * Serialize a grid back to a CSV string. Fields are quoted only when they must
 * be (they contain the delimiter, a quote, or a newline) — this keeps the
 * output diff-friendly and close to what accounting software expects.
 */
export function serializeCsv(grid: Grid, delimiter = ','): string {
  const esc = (v: string) => {
    if (v.includes(delimiter) || v.includes('"') || v.includes('\n') || v.includes('\r')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines: string[] = [];
  lines.push(grid.headers.map(esc).join(delimiter));
  for (const row of grid.rows) lines.push(row.map(esc).join(delimiter));
  // CRLF is the safest line ending for spreadsheet apps across platforms.
  return lines.join('\r\n');
}

export type DedupeMode = {
  /** Column indices that define identity. Empty means "the whole row". */
  keyColumns: number[];
  /** When duplicates are found, which occurrence to keep. */
  keep: 'first' | 'last';
  /** Compare case-insensitively and ignore surrounding whitespace. */
  loose: boolean;
};

export type DedupeResult = { grid: Grid; removed: number; duplicateGroups: number };

/**
 * Remove duplicate rows. Identity is either the entire row or the selected key
 * columns (e.g. a Transaction ID column). Order of kept rows is preserved.
 */
export function dedupeRows(grid: Grid, mode: DedupeMode): DedupeResult {
  const cols = mode.keyColumns.length > 0 ? mode.keyColumns : grid.headers.map((_, i) => i);

  const norm = (v: string) => (mode.loose ? v.trim().toLowerCase() : v);
  const keyOf = (row: string[]) => cols.map((c) => norm(row[c] ?? '')).join(' ');

  // Count occurrences per key so we can report how many groups had duplicates.
  const counts = new Map<string, number>();
  for (const row of grid.rows) {
    const k = keyOf(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let duplicateGroups = 0;
  for (const n of counts.values()) if (n > 1) duplicateGroups++;

  let kept: string[][];
  if (mode.keep === 'first') {
    const seen = new Set<string>();
    kept = grid.rows.filter((row) => {
      const k = keyOf(row);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } else {
    // Keep last: walk from the end, then restore original order.
    const seen = new Set<string>();
    const keepIdx = new Set<number>();
    for (let i = grid.rows.length - 1; i >= 0; i--) {
      const k = keyOf(grid.rows[i]);
      if (!seen.has(k)) {
        seen.add(k);
        keepIdx.add(i);
      }
    }
    kept = grid.rows.filter((_, i) => keepIdx.has(i));
  }

  return {
    grid: { ...grid, rows: kept },
    removed: grid.rows.length - kept.length,
    duplicateGroups,
  };
}

/**
 * Combine several grids into one by aligning columns on header name
 * (case- and whitespace-insensitive). The merged column order is the order
 * headers are first seen; a file missing a column gets blanks for it. This is
 * the useful default when the same export comes from different months or banks
 * with slightly different column sets.
 */
export function mergeGrids(grids: Grid[]): Grid {
  const headerOrder: string[] = [];
  const lowerToIndex = new Map<string, number>();

  for (const g of grids) {
    for (const h of g.headers) {
      const key = h.trim().toLowerCase();
      if (!lowerToIndex.has(key)) {
        lowerToIndex.set(key, headerOrder.length);
        headerOrder.push(h);
      }
    }
  }

  const width = headerOrder.length;
  const rows: string[][] = [];
  for (const g of grids) {
    const colMap = g.headers.map((h) => lowerToIndex.get(h.trim().toLowerCase()) ?? -1);
    for (const row of g.rows) {
      const out = new Array(width).fill('');
      for (let c = 0; c < row.length; c++) {
        const target = colMap[c];
        if (target >= 0) out[target] = row[c] ?? '';
      }
      rows.push(out);
    }
  }

  return { headers: headerOrder, rows, delimiter: ',', hadBom: false };
}

/** Turn a grid into an array of header→value objects (for JSON export). */
export function gridToRecords(grid: Grid): Record<string, string>[] {
  return grid.rows.map((row) => {
    const obj: Record<string, string> = {};
    grid.headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj;
  });
}

/** Human label for a delimiter, for the UI. */
export function delimiterLabel(d: string): string {
  if (d === '\t') return 'Tab';
  if (d === ',') return 'Comma';
  if (d === ';') return 'Semicolon';
  if (d === '|') return 'Pipe';
  return d;
}
