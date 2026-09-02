<script lang="ts">
  import { parseCsv, serializeCsv, type Grid } from '../../lib/csv';
  import { isBalanceReport, reconcileBalance } from '../../lib/stripe';

  let fileName = $state('');
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let decimal = $state<'.' | ','>('.');
  let notBalance = $state(false);

  let fileInput: HTMLInputElement;

  const rec = $derived(grid ? reconcileBalance(grid, decimal) : null);

  function loadText(text: string, name: string) {
    error = '';
    const p = parseCsv(text, true);
    if (!p.ok) { error = p.error; grid = null; return; }
    notBalance = !isBalanceReport(p.grid.headers);
    grid = p.grid; fileName = name;
    const sample = p.grid.rows.flat().find((v) => v && /\d[.,]\d/.test(v));
    if (sample) decimal = sample.lastIndexOf(',') > sample.lastIndexOf('.') ? ',' : '.';
  }
  async function handleFile(f: File) { if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB.'; return; } loadText(await f.text(), f.name); }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function reset() { grid = null; fileName = ''; error = ''; notBalance = false; }

  function money(n: number): string { return (rec?.totals.currency ? rec.totals.currency + ' ' : '') + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function amt(n: number): string { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(n: number): string { return (n < 0 ? '−' : '+') + amt(Math.abs(n)); }

  function downloadCategoryCsv() {
    if (!rec) return;
    const g: Grid = { headers: ['Category', 'Count', 'Gross', 'Fee', 'Net'], rows: rec.byCategory.map((c) => [c.category, String(c.count), c.gross.toFixed(2), c.fee.toFixed(2), c.net.toFixed(2)]), delimiter: ',', hadBom: false };
    const blob = new Blob(['﻿' + serializeCsv(g, ',')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'reconciliation-by-category.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop your Stripe balance report (itemized) here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
      <p class="text-xs text-[color:var(--color-text-dim)] mt-3">Reporting → Reports → Balance summary → Itemized (balance change from activity).</p>
    </div>
  {/if}

  {#if error}<div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>{/if}

  {#if grid && rec}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm"><p class="font-medium">{fileName}</p><p class="text-xs text-[color:var(--color-text-mute)]">{grid.headers.length} columns · {grid.rows.length} rows</p></div>
      <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
    </div>

    {#if notBalance}<div class="p-3 rounded-lg bg-[color:var(--color-accent-500)]/10 border border-[color:var(--color-accent-500)]/30 text-xs text-[color:var(--color-text-mute)]">This does not look like an itemized balance report (needs a reporting-category, a net and a balance-transaction-id column). It still groups what it can by category and net — check against your dashboard.</div>{/if}

    <!-- Reconciliation identity -->
    <div class="p-5 rounded-xl bg-gradient-to-br from-[color:var(--color-brand-500)]/10 to-[color:var(--color-accent-500)]/10 border border-[color:var(--color-brand-500)]/30">
      <p class="text-sm text-[color:var(--color-text-mute)] mb-1">Earned {money(rec.activityNet)} · paid out {money(rec.payoutNet)}</p>
      <p class="text-lg font-bold">Balance changed by <span class="{rec.totals.net < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-brand-400)]'}">{signed(rec.totals.net)}</span></p>
      <p class="text-xs text-[color:var(--color-text-dim)] mt-1">The sum of every net line — this should equal the balance change on the report’s own summary.</p>
    </div>

    <!-- By category -->
    <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2.5 bg-[color:var(--color-surface-2)] border-b border-[color:var(--color-border)]">
        <p class="text-sm font-semibold">By reporting category</p>
        <button class="text-xs text-[color:var(--color-brand-400)] hover:underline inline-flex items-center gap-1" on:click={downloadCategoryCsv}>Export CSV</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead><tr class="bg-[color:var(--color-surface)]">
            <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Category</th>
            <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Count</th>
            <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Gross</th>
            <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Fee</th>
            <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Net</th>
          </tr></thead>
          <tbody>
            {#each rec.byCategory as c}
              <tr class="border-b border-[color:var(--color-border)] last:border-0">
                <td class="px-3 py-1.5 whitespace-nowrap font-medium">{c.category}</td>
                <td class="px-3 py-1.5 text-right text-[color:var(--color-text-mute)]">{c.count}</td>
                <td class="px-3 py-1.5 text-right font-mono whitespace-nowrap text-[color:var(--color-text-mute)]">{amt(c.gross)}</td>
                <td class="px-3 py-1.5 text-right font-mono whitespace-nowrap text-[color:var(--color-text-mute)]">{c.fee ? amt(c.fee) : ''}</td>
                <td class="px-3 py-1.5 text-right font-mono whitespace-nowrap font-medium {c.net < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-success)]'}">{signed(c.net)}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot><tr class="bg-[color:var(--color-surface-2)] font-semibold">
            <td class="px-3 py-2">Total</td>
            <td class="px-3 py-2 text-right">{rec.totals.count}</td>
            <td class="px-3 py-2 text-right font-mono">{amt(rec.totals.gross)}</td>
            <td class="px-3 py-2 text-right font-mono">{amt(rec.totals.fee)}</td>
            <td class="px-3 py-2 text-right font-mono">{signed(rec.totals.net)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>

    <!-- By payout -->
    {#if rec.byPayout.length}
      <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
        <div class="px-4 py-2.5 bg-[color:var(--color-surface-2)] border-b border-[color:var(--color-border)]"><p class="text-sm font-semibold">By payout — what each payout settled</p></div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead><tr class="bg-[color:var(--color-surface)]">
              <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Payout</th>
              <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Transactions</th>
              <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Net</th>
            </tr></thead>
            <tbody>
              {#each rec.byPayout.slice(0, 50) as p}
                <tr class="border-b border-[color:var(--color-border)] last:border-0">
                  <td class="px-3 py-1.5 whitespace-nowrap font-mono text-[color:var(--color-text-mute)]">{p.payoutId}</td>
                  <td class="px-3 py-1.5 text-right text-[color:var(--color-text-mute)]">{p.count}</td>
                  <td class="px-3 py-1.5 text-right font-mono whitespace-nowrap font-medium {p.net < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-success)]'}">{signed(p.net)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <p class="text-xs text-[color:var(--color-text-dim)]">Grouped from your itemized balance report. Net sums are exact arithmetic on the file; the category and payout groupings follow Stripe’s reporting_category and payout id. This tool is built to Stripe’s documented itemized format — cross-check the total against the report’s own balance summary the first time.</p>
  {/if}
</div>
