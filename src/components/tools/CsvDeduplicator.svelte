<script lang="ts">
  import {
    parseCsv,
    dedupeRows,
    serializeCsv,
    delimiterLabel,
    type Grid,
    type DedupeMode,
  } from '../../lib/csv';

  let fileName = $state('');
  let hasHeader = $state(true);
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let copied = $state(false);

  // Which columns define a duplicate. Empty = whole row.
  let keyColumns = $state<number[]>([]);
  let keep = $state<'first' | 'last'>('first');
  let loose = $state(true);

  let fileInput: HTMLInputElement;
  let pasteText = $state('');

  const mode = $derived<DedupeMode>({ keyColumns, keep, loose });
  const result = $derived(grid ? dedupeRows(grid, mode) : null);
  const PREVIEW_ROWS = 12;

  function loadText(text: string, name: string) {
    error = '';
    copied = false;
    keyColumns = [];
    const res = parseCsv(text, hasHeader);
    if (!res.ok) { error = res.error; grid = null; return; }
    grid = res.grid;
    fileName = name;
  }

  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB. Split it first.'; return; }
    loadText(await f.text(), f.name);
  }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function loadPaste() { if (pasteText.trim()) loadText(pasteText, 'pasted.csv'); }
  function reparse() { if (fileName === 'pasted.csv' && pasteText.trim()) loadText(pasteText, 'pasted.csv'); }

  function toggleKey(i: number) {
    keyColumns = keyColumns.includes(i) ? keyColumns.filter((c) => c !== i) : [...keyColumns, i];
  }

  function download() {
    if (!result) return;
    const csv = serializeCsv(result.grid, ',');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'deduplicated') + '.deduped.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyCsv() {
    if (!result) return;
    try { await navigator.clipboard.writeText(serializeCsv(result.grid, ',')); copied = true; setTimeout(() => (copied = false), 1500); } catch {}
  }
  function reset() { grid = null; fileName = ''; pasteText = ''; error = ''; keyColumns = []; }
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a CSV or TSV file here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
    </div>
    <details class="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <summary class="px-4 py-3 text-sm font-medium cursor-pointer select-none">…or paste CSV text</summary>
      <div class="px-4 pb-4 space-y-2">
        <textarea bind:value={pasteText} placeholder="id,name,amount&#10;1,ACME,120" class="w-full h-32 px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm font-mono resize-none"></textarea>
        <button class="px-4 py-2 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white text-sm font-medium disabled:opacity-50" on:click={loadPaste} disabled={!pasteText.trim()}>Load pasted text</button>
      </div>
    </details>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}

  {#if grid && result}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm">
        <p class="font-medium text-[color:var(--color-text)]">{fileName}</p>
        <p class="text-xs text-[color:var(--color-text-mute)]">{delimiterLabel(grid.delimiter)}-delimited · {grid.headers.length} columns · {grid.rows.length} rows</p>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-[color:var(--color-text-mute)]"><input type="checkbox" bind:checked={hasHeader} on:change={reparse} class="rounded" />First row is a header</label>
        <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
      </div>
    </div>

    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
      <div>
        <p class="text-sm font-semibold mb-1">Duplicate identity</p>
        <p class="text-xs text-[color:var(--color-text-mute)] mb-3">
          {keyColumns.length === 0 ? 'A row is a duplicate when the whole row matches. Pick columns to match on just those (e.g. a Transaction ID).' : `Matching on ${keyColumns.length} column${keyColumns.length > 1 ? 's' : ''}.`}
        </p>
        <div class="flex flex-wrap gap-1.5">
          {#each grid.headers as h, i}
            <button
              class="text-xs px-2.5 py-1 rounded-md border transition-colors {keyColumns.includes(i) ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/15 text-[color:var(--color-brand-400)]' : 'border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:border-[color:var(--color-border-strong)]'}"
              on:click={() => toggleKey(i)}
            >{h}</button>
          {/each}
        </div>
      </div>

      <div class="flex flex-wrap gap-4">
        <label class="text-sm">
          <span class="font-semibold block mb-1">Keep</span>
          <select bind:value={keep} class="px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value="first">First occurrence</option>
            <option value="last">Last occurrence</option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-sm mt-6">
          <input type="checkbox" bind:checked={loose} class="rounded" />
          Ignore case and surrounding spaces
        </label>
      </div>
    </div>

    <div class="p-3 rounded-lg bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 text-sm text-[color:var(--color-text)]">
      {#if result.removed === 0}
        No duplicates found — every row is unique.
      {:else}
        Removed <strong>{result.removed}</strong> duplicate row{result.removed > 1 ? 's' : ''} across {result.duplicateGroups} group{result.duplicateGroups > 1 ? 's' : ''}. {result.grid.rows.length} rows remain.
      {/if}
    </div>

    <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead><tr class="bg-[color:var(--color-surface-2)]">
            {#each result.grid.headers as h}<th class="text-left px-3 py-2 font-semibold whitespace-nowrap border-b border-[color:var(--color-border)]">{h}</th>{/each}
          </tr></thead>
          <tbody>
            {#each result.grid.rows.slice(0, PREVIEW_ROWS) as row}
              <tr class="border-b border-[color:var(--color-border)] last:border-0">
                {#each row as c}<td class="px-3 py-1.5 text-[color:var(--color-text-mute)] whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis">{c}</td>{/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if result.grid.rows.length > PREVIEW_ROWS}
        <p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing {PREVIEW_ROWS} of {result.grid.rows.length} rows. The download has all of them.</p>
      {/if}
    </div>

    <div class="flex flex-wrap gap-2">
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2" on:click={download}>
        Download CSV
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium" on:click={copyCsv}>{copied ? 'Copied!' : 'Copy'}</button>
    </div>
  {/if}
</div>
