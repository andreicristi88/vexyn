<script lang="ts">
  import { parseCsv, serializeCsv, type Grid } from '../../lib/csv';
  import { formatBankStatement, type FormatConfig } from '../../lib/bankformat';
  import type { DateFormat } from '../../lib/ofx';

  let fileName = $state('');
  let hasHeader = $state(true);
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let copied = $state(false);

  let cfg = $state<FormatConfig>({
    date: -1, description: -1, balance: -1, category: -1,
    amountMode: 'single', amount: -1, debit: -1, credit: -1,
    dateFormat: 'iso', decimal: '.', flipSign: false,
  });

  let fileInput: HTMLInputElement;
  const PREVIEW = 10;

  const result = $derived(grid ? formatBankStatement(grid, cfg) : null);
  const ready = $derived(
    grid && cfg.date >= 0 &&
    (cfg.amountMode === 'single' ? cfg.amount >= 0 : cfg.debit >= 0 || cfg.credit >= 0),
  );

  function guess(headers: string[], patterns: RegExp[]): number {
    for (let i = 0; i < headers.length; i++) if (patterns.some((p) => p.test(headers[i].toLowerCase()))) return i;
    return -1;
  }

  function autoConfigure(g: Grid) {
    const debit = guess(g.headers, [/debit|withdrawal|paid out|money out/]);
    const credit = guess(g.headers, [/credit|deposit|paid in|money in/]);
    cfg = {
      ...cfg,
      date: guess(g.headers, [/date|posted/]),
      description: guess(g.headers, [/desc|payee|name|merchant|details|narrative|reference|transaction/]),
      balance: guess(g.headers, [/balance/]),
      category: guess(g.headers, [/category|type/]),
      amount: guess(g.headers, [/amount|value|total/]),
      debit,
      credit,
      amountMode: debit >= 0 && credit >= 0 ? 'split' : 'single',
    };
    if (cfg.date >= 0) {
      const s = g.rows.map((r) => r[cfg.date]).find((v) => v && v.trim());
      if (s) {
        const first = s.trim().split(/[\/.\-]/)[0];
        if (first?.length === 4) cfg.dateFormat = 'iso';
        else {
          const c = s.trim().split(/[\/.\-]/).map((x) => parseInt(x, 10));
          cfg.dateFormat = c[0] > 12 ? 'eu' : 'us';
        }
      }
    }
    const amtCol = cfg.amountMode === 'single' ? cfg.amount : cfg.debit;
    if (amtCol >= 0) {
      const s = g.rows.map((r) => r[amtCol]).find((v) => v && /\d/.test(v));
      if (s) cfg.decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    }
  }

  function loadText(text: string, name: string) {
    error = '';
    const res = parseCsv(text, hasHeader);
    if (!res.ok) { error = res.error; grid = null; return; }
    grid = res.grid; fileName = name; autoConfigure(res.grid);
  }
  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB.'; return; }
    loadText(await f.text(), f.name);
  }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function reset() { grid = null; fileName = ''; error = ''; }

  function download() {
    if (!result) return;
    const blob = new Blob(['﻿' + serializeCsv(result.grid, ',')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (fileName.replace(/\.[^.]+$/, '') || 'statement') + '.formatted.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyCsv() {
    if (!result) return;
    try { await navigator.clipboard.writeText(serializeCsv(result.grid, ',')); copied = true; setTimeout(() => (copied = false), 1500); } catch {}
  }
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop any bank CSV export here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
      <label class="flex items-center justify-center gap-1.5 text-xs text-[color:var(--color-text-mute)] mt-4"><input type="checkbox" bind:checked={hasHeader} class="rounded" />First row is a header</label>
    </div>
  {/if}

  {#if error}<div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>{/if}

  {#if grid}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm"><p class="font-medium text-[color:var(--color-text)]">{fileName}</p><p class="text-xs text-[color:var(--color-text-mute)]">{grid.headers.length} columns · {grid.rows.length} rows</p></div>
      <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
    </div>

    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
      <p class="text-sm font-semibold">Map your columns to the standard layout</p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label class="text-sm"><span class="font-medium block mb-1">Date *</span>
          <select bind:value={cfg.date} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {cfg.date < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm">
            <option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Description</span>
          <select bind:value={cfg.description} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value={-1}>— none —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Amount columns</span>
          <select bind:value={cfg.amountMode} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value="single">One signed column</option>
            <option value="split">Separate debit &amp; credit</option>
          </select>
        </label>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#if cfg.amountMode === 'single'}
          <label class="text-sm"><span class="font-medium block mb-1">Amount *</span>
            <select bind:value={cfg.amount} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {cfg.amount < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm">
              <option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
            </select>
          </label>
          <label class="flex items-center gap-2 text-sm mt-6"><input type="checkbox" bind:checked={cfg.flipSign} class="rounded" />Money out is positive (flip signs)</label>
        {:else}
          <label class="text-sm"><span class="font-medium block mb-1">Debit (out)</span>
            <select bind:value={cfg.debit} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
              <option value={-1}>— none —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
            </select>
          </label>
          <label class="text-sm"><span class="font-medium block mb-1">Credit (in)</span>
            <select bind:value={cfg.credit} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
              <option value={-1}>— none —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
            </select>
          </label>
        {/if}
        <label class="text-sm"><span class="font-medium block mb-1">Balance</span>
          <select bind:value={cfg.balance} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value={-1}>— none —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </label>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label class="text-sm"><span class="font-medium block mb-1">Category</span>
          <select bind:value={cfg.category} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value={-1}>— none —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Date format</span>
          <select bind:value={cfg.dateFormat} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value="iso">Year first (2026-01-31)</option><option value="us">Month first (01/31/2026)</option><option value="eu">Day first (31/01/2026)</option>
          </select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Decimal separator</span>
          <select bind:value={cfg.decimal} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value=".">Dot (1,234.56)</option><option value=",">Comma (1.234,56)</option>
          </select>
        </label>
      </div>
    </div>

    {#if ready && result}
      {#if result.issues > 0}
        <div class="p-3 rounded-lg bg-[color:var(--color-accent-500)]/10 border border-[color:var(--color-accent-500)]/30 text-sm text-[color:var(--color-text-mute)]">
          {result.issues} value{result.issues !== 1 ? 's' : ''} could not be normalized and were left as-is — check the date format and decimal separator, or those cells in the original.
        </div>
      {/if}

      <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead><tr class="bg-[color:var(--color-surface-2)]">
              {#each result.grid.headers as h}<th class="text-left px-3 py-2 font-semibold whitespace-nowrap border-b border-[color:var(--color-border)]">{h}</th>{/each}
            </tr></thead>
            <tbody>
              {#each result.grid.rows.slice(0, PREVIEW) as row}
                <tr class="border-b border-[color:var(--color-border)] last:border-0">
                  {#each row as c, ci}<td class="px-3 py-1.5 whitespace-nowrap {ci === 2 ? 'font-mono ' + (c.startsWith('-') ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-success)]') : 'text-[color:var(--color-text-mute)]'} max-w-[280px] overflow-hidden text-ellipsis">{c}</td>{/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if result.grid.rows.length > PREVIEW}<p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing {PREVIEW} of {result.grid.rows.length} rows.</p>{/if}
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2" on:click={download}>
          Download formatted CSV
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium" on:click={copyCsv}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>
    {:else}
      <p class="text-sm text-[color:var(--color-text-mute)]">Map a <strong>Date</strong> column and an <strong>Amount</strong> (or Debit/Credit) column to see the result.</p>
    {/if}
  {/if}
</div>
