<script lang="ts">
  import {
    parseCsv,
    cleanGrid,
    serializeCsv,
    delimiterLabel,
    DEFAULT_CLEAN_OPTIONS,
    type Grid,
    type CleanOptions,
  } from '../../lib/csv';

  let fileName = $state('');
  let hasHeader = $state(true);
  let grid = $state<Grid | null>(null);
  let parseWarnings = $state<string[]>([]);
  let error = $state('');
  let dragOver = $state(false);
  let copied = $state(false);

  let opts = $state<CleanOptions>({ ...DEFAULT_CLEAN_OPTIONS });

  let fileInput: HTMLInputElement;

  // Cleaned output recomputes whenever the grid or any option changes.
  const cleaned = $derived(grid ? cleanGrid(grid, opts) : null);

  const PREVIEW_ROWS = 12;

  function loadText(text: string, name: string) {
    error = '';
    copied = false;
    const res = parseCsv(text, hasHeader);
    if (!res.ok) {
      error = res.error;
      grid = null;
      parseWarnings = [];
      return;
    }
    grid = res.grid;
    parseWarnings = res.warnings;
    fileName = name;
  }

  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) {
      error = 'File is larger than 50 MB. For files this big, split them first or use a desktop tool.';
      return;
    }
    const text = await f.text();
    loadText(text, f.name);
  }

  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.[0]) handleFile(t.files[0]);
    t.value = '';
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }

  let pasteText = $state('');
  function loadPaste() {
    if (!pasteText.trim()) return;
    loadText(pasteText, 'pasted.csv');
  }

  // Re-parse when the header toggle flips (affects how row 1 is treated).
  function reparse() {
    if (fileName === 'pasted.csv' && pasteText.trim()) {
      loadText(pasteText, 'pasted.csv');
    }
  }

  function downloadName(): string {
    const base = fileName.replace(/\.[^.]+$/, '') || 'cleaned';
    return `${base}.cleaned.csv`;
  }

  function download() {
    if (!cleaned) return;
    const csv = serializeCsv(cleaned.grid, ',');
    // Prepend a BOM so Excel opens UTF-8 correctly (accented names, €, etc.).
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyCsv() {
    if (!cleaned) return;
    try {
      await navigator.clipboard.writeText(serializeCsv(cleaned.grid, ','));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {}
  }

  function reset() {
    grid = null;
    fileName = '';
    pasteText = '';
    error = '';
    parseWarnings = [];
  }

  const OPTION_LABELS: { key: keyof CleanOptions; label: string; hint: string }[] = [
    { key: 'trimCells', label: 'Trim whitespace', hint: 'Remove leading/trailing spaces in every cell.' },
    { key: 'cleanHeaders', label: 'Clean headers', hint: 'Trim header names and make duplicates unique.' },
    { key: 'removeEmptyRows', label: 'Remove empty rows', hint: 'Drop rows where every cell is blank.' },
    { key: 'removeDuplicateRows', label: 'Remove duplicate rows', hint: 'Keep the first, drop exact repeats.' },
    { key: 'removeEmptyColumns', label: 'Remove empty columns', hint: 'Drop columns with no data.' },
    { key: 'collapseSpaces', label: 'Collapse double spaces', hint: 'Turn runs of spaces into one.' },
  ];

  function statLine(s: NonNullable<typeof cleaned>['stats']): string {
    const parts: string[] = [];
    if (s.cellsTrimmed) parts.push(`${s.cellsTrimmed} cells trimmed`);
    if (s.emptyRowsRemoved) parts.push(`${s.emptyRowsRemoved} empty rows removed`);
    if (s.duplicateRowsRemoved) parts.push(`${s.duplicateRowsRemoved} duplicates removed`);
    if (s.emptyColumnsRemoved) parts.push(`${s.emptyColumnsRemoved} empty columns removed`);
    if (s.headersRenamed) parts.push(`${s.headersRenamed} headers cleaned`);
    return parts.length ? parts.join(' · ') : 'No changes needed — the file was already clean.';
  }
</script>

<div class="space-y-4">
  {#if !grid}
    <div
      class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone"
    >
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a CSV or TSV file here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
      <p class="text-xs text-[color:var(--color-text-mute)] mt-4">Comma, semicolon, tab and pipe delimiters are detected automatically.</p>
    </div>

    <details class="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <summary class="px-4 py-3 text-sm font-medium cursor-pointer select-none">…or paste CSV text</summary>
      <div class="px-4 pb-4 space-y-2">
        <textarea bind:value={pasteText} placeholder="name,amount,date&#10;ACME,120.00,2026-01-05" class="w-full h-32 px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm font-mono resize-none"></textarea>
        <button class="px-4 py-2 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white text-sm font-medium disabled:opacity-50" on:click={loadPaste} disabled={!pasteText.trim()}>Load pasted text</button>
      </div>
    </details>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}

  {#if grid && cleaned}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm">
        <p class="font-medium text-[color:var(--color-text)]">{fileName}</p>
        <p class="text-xs text-[color:var(--color-text-mute)]">
          {delimiterLabel(grid.delimiter)}-delimited · {grid.headers.length} columns ·
          {cleaned.grid.rows.length} rows{grid.rows.length !== cleaned.grid.rows.length ? ` (from ${grid.rows.length})` : ''}
          {grid.hadBom ? ' · BOM removed' : ''}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-[color:var(--color-text-mute)]">
          <input type="checkbox" bind:checked={hasHeader} on:change={reparse} class="rounded" />
          First row is a header
        </label>
        <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <!-- Cleaning options -->
      <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-3 h-fit">
        <p class="text-sm font-semibold">Cleaning options</p>
        {#each OPTION_LABELS as o}
          <label class="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={opts[o.key]} class="mt-0.5 rounded" />
            <span>
              <span class="text-sm text-[color:var(--color-text)] block">{o.label}</span>
              <span class="text-xs text-[color:var(--color-text-mute)]">{o.hint}</span>
            </span>
          </label>
        {/each}
      </div>

      <!-- Preview + actions -->
      <div class="space-y-3 min-w-0">
        <div class="p-3 rounded-lg bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 text-sm text-[color:var(--color-text)]">
          {statLine(cleaned.stats)}
        </div>

        {#if parseWarnings.length}
          <div class="p-3 rounded-lg bg-[color:var(--color-accent-500)]/10 border border-[color:var(--color-accent-500)]/30 text-xs text-[color:var(--color-text-mute)] space-y-1">
            {#each parseWarnings as w}<p>⚠ {w}</p>{/each}
          </div>
        {/if}

        <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr class="bg-[color:var(--color-surface-2)]">
                  {#each cleaned.grid.headers as h}
                    <th class="text-left px-3 py-2 font-semibold text-[color:var(--color-text)] whitespace-nowrap border-b border-[color:var(--color-border)]">{h}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each cleaned.grid.rows.slice(0, PREVIEW_ROWS) as row}
                  <tr class="border-b border-[color:var(--color-border)] last:border-0">
                    {#each row as c}
                      <td class="px-3 py-1.5 text-[color:var(--color-text-mute)] whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis">{c}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if cleaned.grid.rows.length > PREVIEW_ROWS}
            <p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">
              Showing {PREVIEW_ROWS} of {cleaned.grid.rows.length} rows. The download has all of them.
            </p>
          {/if}
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2" on:click={download}>
            Download cleaned CSV
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium" on:click={copyCsv}>{copied ? 'Copied!' : 'Copy to clipboard'}</button>
        </div>
      </div>
    </div>
  {/if}
</div>
