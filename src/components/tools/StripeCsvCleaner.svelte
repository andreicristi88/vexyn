<script lang="ts">
  import { parseCsv, serializeCsv, type Grid } from '../../lib/csv';
  import { isStripePayments, cleanStripePayments, type StripePayment } from '../../lib/stripe';
  import { EXPORT_FORMATS, type ExportTxn } from '../../lib/exporters';

  let fileName = $state('');
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let decimal = $state<'.' | ','>('.');
  let onlyCaptured = $state(false);
  let notStripe = $state(false);

  let fileInput: HTMLInputElement;

  const clean = $derived(grid ? cleanStripePayments(grid, decimal) : null);
  const rows = $derived.by<StripePayment[]>(() => {
    if (!clean) return [];
    return onlyCaptured ? clean.rows.filter((r) => /paid|refunded|succeeded/i.test(r.status)) : clean.rows;
  });
  const totals = $derived.by(() => {
    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    let gross = 0, fees = 0, refunds = 0, net = 0, currency = '';
    for (const r of rows) { gross += r.amount; fees += r.fee; refunds += r.refunded; net += r.net; if (r.currency && !currency) currency = r.currency; }
    return { gross: r2(gross), fees: r2(fees), refunds: r2(refunds), net: r2(net), count: rows.length, currency };
  });

  function loadText(text: string, name: string) {
    error = '';
    const res = parseCsv(text, true);
    if (!res.ok) { error = res.error; grid = null; return; }
    notStripe = !isStripePayments(res.grid.headers);
    grid = res.grid; fileName = name;
    const sample = res.grid.rows.flat().find((v) => v && /\d[.,]\d/.test(v));
    if (sample) decimal = sample.lastIndexOf(',') > sample.lastIndexOf('.') ? ',' : '.';
  }
  async function handleFile(f: File) { if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB.'; return; } loadText(await f.text(), f.name); }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function reset() { grid = null; fileName = ''; error = ''; notStripe = false; }

  function money(n: number): string { return (totals.currency ? totals.currency + ' ' : '') + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function amt(n: number): string { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function downloadCleanCsv() {
    const headers = ['Date', 'Description', 'Customer Email', 'Amount', 'Fee', 'Refunded', 'Net', 'Currency', 'Status', 'id'];
    const g: Grid = { headers, rows: rows.map((r) => [r.date, r.description, r.email, r.amount.toFixed(2), r.fee.toFixed(2), r.refunded.toFixed(2), r.net.toFixed(2), r.currency, r.status, r.id]), delimiter: ',', hadBom: false };
    const blob = new Blob(['﻿' + serializeCsv(g, ',')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (fileName.replace(/\.[^.]+$/, '') || 'stripe') + '.clean.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadFormat(fmtId: string) {
    const fmt = EXPORT_FORMATS.find((f) => f.id === fmtId)!;
    const ex: ExportTxn[] = rows.map((r) => ({ date: r.date, amount: r.net, description: r.description || r.email || r.id }));
    const text = fmt.build(ex);
    const blob = new Blob([fmt.bom ? '﻿' + text : text], { type: fmt.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stripe-net.${fmt.ext}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop your Stripe payments export here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
      <p class="text-xs text-[color:var(--color-text-dim)] mt-3">Payments → Export, either the default or all-columns version.</p>
    </div>
  {/if}

  {#if error}<div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>{/if}

  {#if grid && clean}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm"><p class="font-medium">{fileName}</p><p class="text-xs text-[color:var(--color-text-mute)]">{grid.headers.length} columns · {grid.rows.length} rows</p></div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs text-[color:var(--color-text-mute)]"><input type="checkbox" bind:checked={onlyCaptured} class="rounded" />Only successful payments</label>
        <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
      </div>
    </div>

    {#if notStripe}
      <div class="p-3 rounded-lg bg-[color:var(--color-accent-500)]/10 border border-[color:var(--color-accent-500)]/30 text-xs text-[color:var(--color-text-mute)]">This does not look like a Stripe payments export (no <code>id</code>/<code>Amount</code>/<code>Currency</code> columns). It still tries to read Amount, Fee and Amount Refunded by name — check the numbers below.</div>
    {/if}

    <!-- Totals -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Gross</p><p class="text-xl font-bold">{money(totals.gross)}</p></div>
      <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Stripe fees</p><p class="text-xl font-bold text-[color:var(--color-danger)]">−{money(totals.fees)}</p></div>
      <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Refunds</p><p class="text-xl font-bold text-[color:var(--color-danger)]">−{money(totals.refunds)}</p></div>
      <div class="p-4 rounded-xl bg-gradient-to-br from-[color:var(--color-brand-500)]/10 to-[color:var(--color-accent-500)]/10 border border-[color:var(--color-brand-500)]/30"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Net</p><p class="text-xl font-bold text-[color:var(--color-brand-400)]">{money(totals.net)}</p></div>
    </div>

    <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead><tr class="bg-[color:var(--color-surface-2)]">
            <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Date</th>
            <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Description</th>
            <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Customer</th>
            <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Amount</th>
            <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Fee</th>
            <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Refunded</th>
            <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)] text-[color:var(--color-brand-400)]">Net</th>
            <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Status</th>
          </tr></thead>
          <tbody>
            {#each rows.slice(0, 50) as r}
              <tr class="border-b border-[color:var(--color-border)] last:border-0">
                <td class="px-3 py-1.5 whitespace-nowrap font-mono text-[color:var(--color-text-mute)]">{r.date}</td>
                <td class="px-3 py-1.5 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{r.description}</td>
                <td class="px-3 py-1.5 text-[color:var(--color-text-mute)] max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">{r.email}</td>
                <td class="px-3 py-1.5 text-right font-mono whitespace-nowrap">{amt(r.amount)}</td>
                <td class="px-3 py-1.5 text-right font-mono whitespace-nowrap text-[color:var(--color-text-mute)]">{r.fee ? amt(r.fee) : ''}</td>
                <td class="px-3 py-1.5 text-right font-mono whitespace-nowrap text-[color:var(--color-danger)]">{r.refunded ? amt(r.refunded) : ''}</td>
                <td class="px-3 py-1.5 text-right font-mono whitespace-nowrap font-medium {r.net < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-brand-400)]'}">{amt(r.net)}</td>
                <td class="px-3 py-1.5 whitespace-nowrap text-[color:var(--color-text-mute)]">{r.status}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if rows.length > 50}<p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing 50 of {rows.length}. The export has all of them.</p>{/if}
    </div>

    <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="flex flex-wrap gap-2 items-center">
        <button class="px-4 py-2 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white text-sm font-medium inline-flex items-center gap-2" on:click={downloadCleanCsv}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Clean CSV
        </button>
        <span class="text-xs text-[color:var(--color-text-dim)]">or export net amounts to:</span>
        {#each EXPORT_FORMATS as f}
          <button class="px-3 py-2 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-brand-500)] hover:text-[color:var(--color-brand-400)] text-sm transition-colors" on:click={() => downloadFormat(f.id)}>{f.label}</button>
        {/each}
      </div>
    </div>
  {/if}
</div>
