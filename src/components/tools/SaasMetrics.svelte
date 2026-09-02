<script lang="ts">
  import { parseCsv, serializeCsv, type Grid } from '../../lib/csv';
  import { computeSaasMetrics, DEFAULT_SAAS_MAP, type SaasMap } from '../../lib/saas';

  let fileName = $state('');
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let decimal = $state<'.' | ','>('.');
  let map = $state<SaasMap>({ ...DEFAULT_SAAS_MAP });

  let fileInput: HTMLInputElement;

  const ready = $derived(!!grid && map.amount >= 0);
  const m = $derived(grid && ready ? computeSaasMetrics(grid, map, decimal) : null);
  const maxPlan = $derived(m ? m.byPlan.reduce((x, p) => Math.max(x, p.mrr), 0) || 1 : 1);

  function guess(headers: string[], patterns: RegExp[]): number {
    for (let i = 0; i < headers.length; i++) if (patterns.some((p) => p.test(headers[i].toLowerCase()))) return i;
    return -1;
  }
  function loadText(text: string, name: string) {
    error = '';
    const res = parseCsv(text, true);
    if (!res.ok) { error = res.error; grid = null; return; }
    grid = res.grid; fileName = name;
    map = {
      amount: guess(res.grid.headers, [/^amount$|price|mrr|value|^total$|recurring/]),
      interval: guess(res.grid.headers, [/interval|billing.?period|frequency|cycle|recurring.?period/]),
      quantity: guess(res.grid.headers, [/quantity|qty|seats|units/]),
      status: guess(res.grid.headers, [/status|state/]),
      plan: guess(res.grid.headers, [/^plan$|product|tier|package|subscription.?name/]),
      currency: guess(res.grid.headers, [/currency/]),
    };
    const amtCol = map.amount;
    if (amtCol >= 0) { const v = res.grid.rows.map((r) => r[amtCol]).find((x) => x && /\d/.test(x)); if (v) decimal = v.lastIndexOf(',') > v.lastIndexOf('.') ? ',' : '.'; }
  }
  async function handleFile(f: File) { if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB.'; return; } loadText(await f.text(), f.name); }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function reset() { grid = null; fileName = ''; error = ''; map = { ...DEFAULT_SAAS_MAP }; }

  function money(n: number): string { return (m?.currency ? m.currency + ' ' : '') + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function downloadSummary() {
    if (!m) return;
    const g: Grid = { headers: ['Plan', 'MRR', 'Subscriptions'], rows: m.byPlan.map((p) => [p.plan, p.mrr.toFixed(2), String(p.count)]), delimiter: ',', hadBom: false };
    const blob = new Blob(['﻿' + serializeCsv(g, ',')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mrr-by-plan.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a subscriptions export here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
      <p class="text-xs text-[color:var(--color-text-dim)] mt-3">Works with Stripe, Chargebee, Paddle or a plain spreadsheet.</p>
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
        <label class="text-sm"><span class="font-medium block mb-1">Amount *</span>
          <select bind:value={map.amount} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {map.amount < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm"><option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Billing interval</span>
          <select bind:value={map.interval} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>— amounts are monthly —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
          <span class="text-xs text-[color:var(--color-text-dim)]">month / year / week / day</span>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Status</span>
          <select bind:value={map.status} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>— all count as active —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Quantity</span>
          <select bind:value={map.quantity} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>— 1 each —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Plan / product</span>
          <select bind:value={map.plan} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>— none —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Decimal separator</span>
          <select bind:value={decimal} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value=".">Dot (1,234.56)</option><option value=",">Comma (1.234,56)</option></select>
        </label>
      </div>
    </div>

    {#if !ready}
      <p class="text-sm text-[color:var(--color-text-mute)]">Choose the <strong>Amount</strong> column to calculate MRR.</p>
    {:else if m}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="p-4 rounded-xl bg-gradient-to-br from-[color:var(--color-brand-500)]/10 to-[color:var(--color-accent-500)]/10 border border-[color:var(--color-brand-500)]/30"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">MRR</p><p class="text-xl font-bold text-[color:var(--color-brand-400)]">{money(m.mrr)}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">ARR</p><p class="text-xl font-bold">{money(m.arr)}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Active subscriptions</p><p class="text-xl font-bold text-[color:var(--color-success)]">{m.activeCount}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">ARPU</p><p class="text-xl font-bold">{money(m.arpu)}</p></div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Trialing</p><p class="text-lg font-bold">{m.trialingCount}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Canceled / ended</p><p class="text-lg font-bold {m.canceledCount ? 'text-[color:var(--color-danger)]' : ''}">{m.canceledCount}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Lost MRR (canceled)</p><p class="text-lg font-bold {m.lostMrr ? 'text-[color:var(--color-danger)]' : ''}">{money(m.lostMrr)}</p></div>
      </div>

      {#if m.byPlan.length}
        <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm font-semibold">MRR by plan</p>
            <button class="px-3 py-1.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-brand-500)] hover:text-[color:var(--color-brand-400)] text-xs inline-flex items-center gap-1.5 transition-colors" on:click={downloadSummary}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          </div>
          <div class="space-y-2.5">
            {#each m.byPlan as p}
              <div class="flex items-center gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline justify-between gap-3 mb-1"><span class="text-sm font-medium truncate">{p.plan}</span><span class="text-sm font-mono whitespace-nowrap text-[color:var(--color-brand-400)]">{money(p.mrr)}/mo</span></div>
                  <div class="h-2 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden"><div class="h-full rounded-full bg-[color:var(--color-brand-500)]" style="width:{Math.max(2, (p.mrr / maxPlan) * 100)}%"></div></div>
                </div>
                <span class="w-14 text-xs text-[color:var(--color-text-dim)] text-right whitespace-nowrap">{p.count} sub{p.count !== 1 ? 's' : ''}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
      <p class="text-xs text-[color:var(--color-text-dim)]">MRR normalizes every paying subscription to a monthly figure (yearly ÷ 12, and so on) times quantity; trials are counted but excluded. “Lost MRR” is the monthly value of canceled subscriptions in this file — a snapshot, not a cohort churn rate.</p>
    {/if}
  {/if}
</div>
