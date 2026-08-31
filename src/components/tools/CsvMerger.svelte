<script lang="ts">
  import { parseCsv, mergeGrids, serializeCsv, type Grid } from '../../lib/csv';

  type Item = { id: string; name: string; grid: Grid };

  let items = $state<Item[]>([]);
  let hasHeader = $state(true);
  let error = $state('');
  let dragOver = $state(false);
  let copied = $state(false);
  let fileInput: HTMLInputElement;

  const merged = $derived(items.length ? mergeGrids(items.map((i) => i.grid)) : null);
  const PREVIEW_ROWS = 12;

  function uid() { return Math.random().toString(36).slice(2, 10); }

  async function addFiles(files: FileList | File[]) {
    error = '';
    copied = false;
    for (const f of Array.from(files)) {
      if (!/\.(csv|tsv|txt)$/i.test(f.name) && f.type !== 'text/csv') continue;
      if (f.size > 50 * 1024 * 1024) { error = `${f.name} is larger than 50 MB — skipped.`; continue; }
      const res = parseCsv(await f.text(), hasHeader);
      if (!res.ok) { error = `${f.name}: ${res.error}`; continue; }
      items = [...items, { id: uid(), name: f.name, grid: res.grid }];
    }
  }

  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files) addFiles(t.files); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function remove(id: string) { items = items.filter((i) => i.id !== id); }
  function clearAll() { items = []; error = ''; }

  function download() {
    if (!merged) return;
    const blob = new Blob(['﻿' + serializeCsv(merged, ',')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'merged.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyCsv() {
    if (!merged) return;
    try { await navigator.clipboard.writeText(serializeCsv(merged, ',')); copied = true; setTimeout(() => (copied = false), 1500); } catch {}
  }
</script>

<div class="space-y-4">
  <div class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
    on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
    <p class="text-[color:var(--color-text-mute)] mb-3">{items.length === 0 ? 'Drop two or more CSV files here, or' : 'Add more files, or'}</p>
    <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose files</button>
    <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" multiple class="hidden" on:change={onPick} />
    <label class="flex items-center justify-center gap-1.5 text-xs text-[color:var(--color-text-mute)] mt-4"><input type="checkbox" bind:checked={hasHeader} class="rounded" />First row of each file is a header</label>
  </div>

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}

  {#if items.length}
    <div class="space-y-2">
      {#each items as it, i (it.id)}
        <div class="flex items-center gap-3 p-3 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
          <span class="text-xs font-mono text-[color:var(--color-text-dim)] w-5">{i + 1}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{it.name}</p>
            <p class="text-xs text-[color:var(--color-text-mute)]">{it.grid.headers.length} columns · {it.grid.rows.length} rows</p>
          </div>
          <button class="p-1.5 text-[color:var(--color-text-mute)] hover:text-[color:var(--color-danger)]" on:click={() => remove(it.id)} aria-label="Remove">×</button>
        </div>
      {/each}
    </div>
  {/if}

  {#if merged}
    <div class="p-3 rounded-lg bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 text-sm text-[color:var(--color-text)]">
      Merged {items.length} file{items.length > 1 ? 's' : ''} into <strong>{merged.rows.length}</strong> rows across <strong>{merged.headers.length}</strong> columns (aligned by column name).
    </div>

    <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead><tr class="bg-[color:var(--color-surface-2)]">
            {#each merged.headers as h}<th class="text-left px-3 py-2 font-semibold whitespace-nowrap border-b border-[color:var(--color-border)]">{h}</th>{/each}
          </tr></thead>
          <tbody>
            {#each merged.rows.slice(0, PREVIEW_ROWS) as row}
              <tr class="border-b border-[color:var(--color-border)] last:border-0">
                {#each row as c}<td class="px-3 py-1.5 text-[color:var(--color-text-mute)] whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis">{c}</td>{/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if merged.rows.length > PREVIEW_ROWS}
        <p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing {PREVIEW_ROWS} of {merged.rows.length} rows. The download has all of them.</p>
      {/if}
    </div>

    <div class="flex flex-wrap gap-2">
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2" on:click={download}>
        Download merged CSV
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium" on:click={copyCsv}>{copied ? 'Copied!' : 'Copy'}</button>
      <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] text-sm text-[color:var(--color-text-mute)]" on:click={clearAll}>Clear all</button>
    </div>
  {/if}
</div>
