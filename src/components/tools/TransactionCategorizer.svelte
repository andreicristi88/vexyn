<script lang="ts">
  import { parseCsv, serializeCsv, type Grid } from '../../lib/csv';
  import { categorizeText } from '../../lib/statement';

  let fileName = $state('');
  let hasHeader = $state(true);
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let descCol = $state(-1);
  let copied = $state(false);

  let fileInput: HTMLInputElement;
  const PREVIEW = 12;

  // Output grid = original headers + a Category column; original cells untouched.
  const out = $derived.by(() => {
    if (!grid || descCol < 0) return null;
    const headers = [...grid.headers, 'Category'];
    const rows = grid.rows.map((r) => [...r, categorizeText(r[descCol] ?? '')]);
    const g: Grid = { headers, rows, delimiter: grid.delimiter, hadBom: grid.hadBom };
    return g;
  });

  const counts = $derived.by(() => {
    if (!out) return [] as { category: string; count: number }[];
    const m = new Map<string, number>();
    for (const r of out.rows) { const c = r[r.length - 1]; m.set(c, (m.get(c) ?? 0) + 1); }
    return [...m.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  });

  function guess(headers: string[], patterns: RegExp[]): number {
    for (let i = 0; i < headers.length; i++) if (patterns.some((p) => p.test(headers[i].toLowerCase()))) return i;
    return -1;
  }
  function loadText(text: string, name: string) {
    error = ''; copied = false;
    const res = parseCsv(text, hasHeader);
    if (!res.ok) { error = res.error; grid = null; return; }
    grid = res.grid; fileName = name;
    descCol = guess(res.grid.headers, [/desc|payee|name|merchant|details|narrative|reference|memo|transaction/]);
  }
  async function handleFile(f: File) { if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB.'; return; } loadText(await f.text(), f.name); }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function reset() { grid = null; fileName = ''; error = ''; descCol = -1; }

  function download() {
    if (!out) return;
    const csv = serializeCsv(out, ',');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'transactions') + '.categorized.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyCsv() {
    if (!out) return;
    try { await navigator.clipboard.writeText(serializeCsv(out, ',')); copied = true; setTimeout(() => (copied = false), 1500); } catch {}
  }
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop your transactions CSV here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
      <label class="flex items-center justify-center gap-1.5 text-xs text-[color:var(--color-text-mute)] mt-4"><input type="checkbox" bind:checked={hasHeader} class="rounded" />First row is a header</label>
    </div>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}

  {#if grid && out}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm">
        <p class="font-medium text-[color:var(--color-text)]">{fileName}</p>
        <p class="text-xs text-[color:var(--color-text-mute)]">{grid.headers.length} columns · {grid.rows.length} rows</p>
      </div>
      <div class="flex items-center gap-3">
        <label class="text-xs text-[color:var(--color-text-mute)] flex items-center gap-1.5">
          Category from
          <select bind:value={descCol} class="px-2 py-1 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-xs">
            <option value={-1}>— choose column —</option>
            {#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </label>
        <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
      </div>
    </div>

    <!-- Category counts -->
    <div class="flex flex-wrap gap-2">
      {#each counts as c}
        <span class="text-xs px-2.5 py-1 rounded-full border {c.category === 'Uncategorized' ? 'border-[color:var(--color-border)] text-[color:var(--color-text-mute)]' : 'border-[color:var(--color-brand-500)]/30 text-[color:var(--color-brand-400)] bg-[color:var(--color-brand-500)]/8'}">{c.category} · {c.count}</span>
      {/each}
    </div>

    <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead><tr class="bg-[color:var(--color-surface-2)]">
            {#each out.headers as h, i}
              <th class="text-left px-3 py-2 font-semibold whitespace-nowrap border-b border-[color:var(--color-border)] {i === out.headers.length - 1 ? 'text-[color:var(--color-brand-400)]' : 'text-[color:var(--color-text)]'}">{h}</th>
            {/each}
          </tr></thead>
          <tbody>
            {#each out.rows.slice(0, PREVIEW) as row}
              <tr class="border-b border-[color:var(--color-border)] last:border-0">
                {#each row as c, i}
                  <td class="px-3 py-1.5 whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis {i === row.length - 1 ? 'font-medium text-[color:var(--color-brand-400)]' : 'text-[color:var(--color-text-mute)]'}">{c}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if out.rows.length > PREVIEW}
        <p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing {PREVIEW} of {out.rows.length} rows. The download has all of them.</p>
      {/if}
    </div>

    <div class="flex flex-wrap gap-2">
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2" on:click={download}>
        Download categorized CSV
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium" on:click={copyCsv}>{copied ? 'Copied!' : 'Copy to clipboard'}</button>
    </div>
    <p class="text-xs text-[color:var(--color-text-dim)]">Categories are added by keyword matching on the chosen column — best-effort, not authoritative. Your original columns and values are kept exactly as they were; only a Category column is appended.</p>
  {/if}
</div>
