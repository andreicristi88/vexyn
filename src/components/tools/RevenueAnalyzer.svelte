<script lang="ts">
  import { parseCsv, serializeCsv, type Grid } from '../../lib/csv';
  import { parseDateToYmd, parseAmount, type DateFormat } from '../../lib/ofx';

  let fileName = $state('');
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);

  let dateCol = $state(-1);
  let amountCol = $state(-1);
  let groupCol = $state(-1);
  let dateFormat = $state<DateFormat>('iso');
  let decimal = $state<'.' | ','>('.');
  let sym = $state('$');
  let view = $state<'group' | 'month'>('group');

  let fileInput: HTMLInputElement;

  type Row = { ymd: string; month: string; amount: number; group: string };

  const parsed = $derived.by(() => {
    if (!grid || dateCol < 0 || amountCol < 0) return null;
    const rows: Row[] = [];
    let skipped = 0;
    for (const r of grid.rows) {
      const ymd = parseDateToYmd(r[dateCol] ?? '', dateFormat);
      const amount = parseAmount(r[amountCol] ?? '', decimal);
      if (ymd === null || amount === null) { skipped++; continue; }
      const group = (groupCol >= 0 ? (r[groupCol] ?? '').trim() : '') || '(ungrouped)';
      rows.push({ ymd, month: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}`, amount, group });
    }
    return { rows, skipped };
  });

  const total = $derived(parsed ? round2(parsed.rows.reduce((s, r) => s + r.amount, 0)) : 0);

  const byMonth = $derived.by(() => {
    if (!parsed) return [] as { key: string; total: number; count: number }[];
    const m = new Map<string, { total: number; count: number }>();
    for (const r of parsed.rows) { const e = m.get(r.month) ?? { total: 0, count: 0 }; e.total += r.amount; e.count++; m.set(r.month, e); }
    return [...m.entries()].map(([key, v]) => ({ key, total: round2(v.total), count: v.count })).sort((a, b) => a.key.localeCompare(b.key));
  });

  const byGroup = $derived.by(() => {
    if (!parsed) return [] as { key: string; total: number; count: number }[];
    const m = new Map<string, { total: number; count: number }>();
    for (const r of parsed.rows) { const e = m.get(r.group) ?? { total: 0, count: 0 }; e.total += r.amount; e.count++; m.set(r.group, e); }
    return [...m.entries()].map(([key, v]) => ({ key, total: round2(v.total), count: v.count })).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  });

  const rows = $derived(view === 'month' ? byMonth : byGroup);
  const maxAbs = $derived(rows.reduce((m, r) => Math.max(m, Math.abs(r.total)), 0) || 1);

  function round2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function money(n: number): string { return sym + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function monthLabel(m: string): string { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); }
  function rowLabel(k: string): string { return view === 'month' ? monthLabel(k) : k; }

  function guess(headers: string[], patterns: RegExp[]): number {
    for (let i = 0; i < headers.length; i++) if (patterns.some((p) => p.test(headers[i].toLowerCase()))) return i;
    return -1;
  }
  function loadText(text: string, name: string) {
    error = '';
    const res = parseCsv(text, true);
    if (!res.ok) { error = res.error; grid = null; return; }
    grid = res.grid; fileName = name;
    dateCol = guess(res.grid.headers, [/date|created|paid|time/]);
    amountCol = guess(res.grid.headers, [/amount|total|net|revenue|price|value|gross|paid/]);
    groupCol = guess(res.grid.headers, [/product|item|plan|customer|client|name|sku|category|description/]);
    if (dateCol >= 0) { const v = res.grid.rows.map((r) => r[dateCol]).find((x) => x && x.trim()); if (v) { const first = v.trim().split(/[\/.\-]/)[0]; if (first && first.length === 4) dateFormat = 'iso'; else { const c = v.trim().split(/[\/.\-]/).map((x) => parseInt(x, 10)); dateFormat = c[0] > 12 ? 'eu' : c[1] > 12 ? 'us' : 'us'; } } }
    if (amountCol >= 0) { const v = res.grid.rows.map((r) => r[amountCol]).find((x) => x && /\d/.test(x)); if (v) decimal = v.lastIndexOf(',') > v.lastIndexOf('.') ? ',' : '.'; }
  }
  async function handleFile(f: File) { if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB.'; return; } loadText(await f.text(), f.name); }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function reset() { grid = null; fileName = ''; error = ''; dateCol = -1; amountCol = -1; groupCol = -1; }

  function downloadSummary() {
    const label = view === 'month' ? 'Month' : (groupCol >= 0 && grid ? grid.headers[groupCol] : 'Group');
    const g: Grid = { headers: [label, 'Revenue', 'Count'], rows: rows.map((r) => [rowLabel(r.key), r.total.toFixed(2), String(r.count)]), delimiter: ',', hadBom: false };
    const blob = new Blob(['﻿' + serializeCsv(g, ',')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `revenue-by-${view}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a sales or revenue CSV here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
    </div>
  {/if}

  {#if error}<div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>{/if}

  {#if grid}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm"><p class="font-medium">{fileName}</p><p class="text-xs text-[color:var(--color-text-mute)]">{grid.headers.length} columns · {grid.rows.length} rows</p></div>
      <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
    </div>

    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <p class="text-sm font-semibold mb-3">Map your columns</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label class="text-sm"><span class="font-medium block mb-1">Date *</span>
          <select bind:value={dateCol} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {dateCol < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm"><option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Amount *</span>
          <select bind:value={amountCol} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {amountCol < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm"><option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Group by</span>
          <select bind:value={groupCol} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>— none —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
          <span class="text-xs text-[color:var(--color-text-dim)]">product, customer, plan…</span>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Date format</span>
          <select bind:value={dateFormat} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value="iso">Year first (2026-01-31)</option><option value="us">Month first (01/31/2026)</option><option value="eu">Day first (31/01/2026)</option></select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Decimal separator</span>
          <select bind:value={decimal} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value=".">Dot (1,234.56)</option><option value=",">Comma (1.234,56)</option></select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Currency symbol</span>
          <input bind:value={sym} maxlength="3" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm" />
        </label>
      </div>
    </div>

    {#if !parsed}
      <p class="text-sm text-[color:var(--color-text-mute)]">Choose a <strong>Date</strong> and an <strong>Amount</strong> column to break down your revenue.</p>
    {:else}
      {#if parsed.skipped}<div class="p-3 rounded-lg bg-[color:var(--color-accent-500)]/10 border border-[color:var(--color-accent-500)]/30 text-xs text-[color:var(--color-text-mute)]">{parsed.skipped} row{parsed.skipped !== 1 ? 's' : ''} skipped (unreadable date or amount). Check the date format and decimal separator.</div>{/if}

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Total revenue</p><p class="text-xl font-bold text-[color:var(--color-success)]">{money(total)}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Records</p><p class="text-xl font-bold">{parsed.rows.length}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Months</p><p class="text-xl font-bold">{byMonth.length}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">{groupCol >= 0 ? grid.headers[groupCol] : 'Groups'}</p><p class="text-xl font-bold">{byGroup.length}</p></div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex rounded-lg border border-[color:var(--color-border)] overflow-hidden text-sm">
          <button class="px-4 py-2 {view === 'group' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)]'}" on:click={() => (view = 'group')}>By {groupCol >= 0 ? grid.headers[groupCol].toLowerCase() : 'group'}</button>
          <button class="px-4 py-2 {view === 'month' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)]'}" on:click={() => (view = 'month')}>By month</button>
        </div>
        <button class="px-3 py-2 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-brand-500)] hover:text-[color:var(--color-brand-400)] text-sm inline-flex items-center gap-1.5 transition-colors" on:click={downloadSummary}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download summary CSV
        </button>
      </div>

      <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-2.5">
        {#each rows.slice(0, 20) as r}
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline justify-between gap-3 mb-1"><span class="text-sm font-medium truncate">{rowLabel(r.key)}</span><span class="text-sm font-mono whitespace-nowrap {r.total < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-success)]'}">{money(r.total)}</span></div>
              <div class="h-2 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden"><div class="h-full rounded-full {r.total < 0 ? 'bg-[color:var(--color-danger)]' : 'bg-[color:var(--color-success)]'}" style="width:{Math.max(2, (Math.abs(r.total) / maxAbs) * 100)}%"></div></div>
            </div>
            <span class="w-14 text-xs text-[color:var(--color-text-dim)] text-right whitespace-nowrap">{r.count}×</span>
          </div>
        {/each}
        {#if rows.length > 20}<p class="text-xs text-[color:var(--color-text-dim)] pt-1">+{rows.length - 20} more in the CSV export.</p>{/if}
      </div>
    {/if}
  {/if}
</div>
