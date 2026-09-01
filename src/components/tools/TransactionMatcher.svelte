<script lang="ts">
  import { parseCsv, type Grid } from '../../lib/csv';
  import { buildTransactions, DEFAULT_MAP, type StatementMap, type DateFormat, type Txn } from '../../lib/statement';
  import { matchTransactions, sumAmount } from '../../lib/matcher';
  import { EXPORT_FORMATS, type ExportTxn } from '../../lib/exporters';

  type Slot = {
    label: string;
    hint: string;
    fileName: string;
    grid: Grid | null;
    map: StatementMap;
    dateFormat: DateFormat;
    decimal: '.' | ',';
    dragOver: boolean;
    error: string;
  };

  function newSlot(label: string, hint: string): Slot {
    return { label, hint, fileName: '', grid: null, map: { ...DEFAULT_MAP }, dateFormat: 'iso', decimal: '.', dragOver: false, error: '' };
  }

  let A = $state<Slot>(newSlot('List A', 'e.g. your own records'));
  let B = $state<Slot>(newSlot('List B', 'e.g. the bank statement'));
  let amountTolerance = $state(0);
  let dateToleranceDays = $state(0);
  let view = $state<'matched' | 'onlyA' | 'onlyB'>('onlyA');
  let sym = $state('$');

  let inputA: HTMLInputElement;
  let inputB: HTMLInputElement;

  const txnsA = $derived(slotReady(A) ? buildTransactions(A.grid!.rows, A.map, A.dateFormat, A.decimal) : null);
  const txnsB = $derived(slotReady(B) ? buildTransactions(B.grid!.rows, B.map, B.dateFormat, B.decimal) : null);
  const result = $derived(txnsA && txnsB ? matchTransactions(txnsA.txns, txnsB.txns, { amountTolerance, dateToleranceDays }) : null);

  const viewRows = $derived.by<Txn[]>(() => {
    if (!result) return [];
    if (view === 'matched') return result.matched.map((p) => p.a);
    if (view === 'onlyA') return result.onlyA;
    return result.onlyB;
  });

  function slotReady(s: Slot): boolean {
    return !!s.grid && s.map.date >= 0 && (s.map.amountMode === 'single' ? s.map.amount >= 0 : s.map.debit >= 0 || s.map.credit >= 0);
  }
  function guess(headers: string[], patterns: RegExp[]): number {
    for (let i = 0; i < headers.length; i++) if (patterns.some((p) => p.test(headers[i].toLowerCase()))) return i;
    return -1;
  }
  function autoConfigure(s: Slot, g: Grid) {
    const debit = guess(g.headers, [/debit|paid out|withdrawal|money out|\bout\b|\bdr\b/]);
    const credit = guess(g.headers, [/credit|paid in|deposit|money in|\bin\b|\bcr\b/]);
    const amount = guess(g.headers, [/amount|value|total|sum|net/]);
    const useSplit = debit >= 0 && credit >= 0 && amount < 0;
    s.map = { ...DEFAULT_MAP, amountMode: useSplit ? 'split' : 'single', date: guess(g.headers, [/date|posted|time/]), amount, debit, credit, description: guess(g.headers, [/desc|payee|name|merchant|details|narrative|reference|memo/]) };
    if (s.map.date >= 0) { const v = g.rows.map((r) => r[s.map.date]).find((x) => x && x.trim()); if (v) { const first = v.trim().split(/[\/.\-]/)[0]; if (first && first.length === 4) s.dateFormat = 'iso'; else { const c = v.trim().split(/[\/.\-]/).map((x) => parseInt(x, 10)); s.dateFormat = c[0] > 12 ? 'eu' : c[1] > 12 ? 'us' : 'us'; } } }
    const amtCol = useSplit ? (debit >= 0 ? debit : credit) : amount;
    if (amtCol >= 0) { const v = g.rows.map((r) => r[amtCol]).find((x) => x && /\d/.test(x)); if (v) s.decimal = v.lastIndexOf(',') > v.lastIndexOf('.') ? ',' : '.'; }
  }
  async function loadFile(s: Slot, f: File) {
    s.error = '';
    if (f.size > 50 * 1024 * 1024) { s.error = 'File is larger than 50 MB.'; return; }
    const res = parseCsv(await f.text(), true);
    if (!res.ok) { s.error = res.error; s.grid = null; return; }
    s.grid = res.grid; s.fileName = f.name; autoConfigure(s, res.grid);
  }
  function reset(s: Slot) { s.grid = null; s.fileName = ''; s.error = ''; s.map = { ...DEFAULT_MAP }; }

  function money(n: number): string { return sym + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(n: number): string { return (n < 0 ? '−' : '+') + money(n); }

  function download(fmtId: string) {
    const fmt = EXPORT_FORMATS.find((f) => f.id === fmtId)!;
    const rows: ExportTxn[] = viewRows.map((t) => ({ date: t.date, amount: t.amount, description: t.description }));
    const text = fmt.build(rows);
    const blob = new Blob([fmt.bom ? '﻿' + text : text], { type: fmt.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${view}.${fmt.ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<div class="space-y-4">
  <!-- Two upload slots -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {#each [A, B] as slot, si (slot.label)}
      <div class="space-y-3">
        {#if !slot.grid}
          <div class="dropzone-tint border-2 border-dashed rounded-xl p-8 text-center {slot.dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
            role="region" aria-label="{slot.label} drop zone"
            on:dragover={(e) => { e.preventDefault(); slot.dragOver = true; }}
            on:dragleave={() => (slot.dragOver = false)}
            on:drop={(e) => { e.preventDefault(); slot.dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) loadFile(slot, f); }}>
            <p class="text-sm font-semibold mb-1">{slot.label}</p>
            <p class="text-xs text-[color:var(--color-text-dim)] mb-3">{slot.hint}</p>
            <button class="px-4 py-2 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white text-sm font-medium transition-colors" on:click={() => (si === 0 ? inputA : inputB).click()}>Choose file</button>
            {#if si === 0}
              <input bind:this={inputA} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={(e) => { const t = e.currentTarget; if (t.files?.[0]) loadFile(slot, t.files[0]); t.value = ''; }} />
            {:else}
              <input bind:this={inputB} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={(e) => { const t = e.currentTarget; if (t.files?.[0]) loadFile(slot, t.files[0]); t.value = ''; }} />
            {/if}
          </div>
        {:else}
          <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-[color:var(--color-brand-400)]">{slot.label}</p>
                <p class="text-sm font-medium truncate">{slot.fileName}</p>
                <p class="text-xs text-[color:var(--color-text-mute)]">{slot.grid.headers.length} cols · {slot.grid.rows.length} rows</p>
              </div>
              <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] shrink-0" on:click={() => reset(slot)}>Change</button>
            </div>
            <div class="inline-flex rounded-lg border border-[color:var(--color-border)] overflow-hidden text-xs">
              <button class="px-2.5 py-1 {slot.map.amountMode === 'single' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)]'}" on:click={() => (slot.map.amountMode = 'single')}>One amount</button>
              <button class="px-2.5 py-1 {slot.map.amountMode === 'split' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)]'}" on:click={() => (slot.map.amountMode = 'split')}>Debit / credit</button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <label class="text-xs">Date *
                <select bind:value={slot.map.date} class="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-[color:var(--color-surface-2)] border {slot.map.date < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm"><option value={-1}>—</option>{#each slot.grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
              </label>
              {#if slot.map.amountMode === 'single'}
                <label class="text-xs">Amount *
                  <select bind:value={slot.map.amount} class="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-[color:var(--color-surface-2)] border {slot.map.amount < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm"><option value={-1}>—</option>{#each slot.grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
                </label>
              {:else}
                <label class="text-xs">Debit
                  <select bind:value={slot.map.debit} class="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>—</option>{#each slot.grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
                </label>
                <label class="text-xs">Credit
                  <select bind:value={slot.map.credit} class="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>—</option>{#each slot.grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
                </label>
              {/if}
              <label class="text-xs">Description
                <select bind:value={slot.map.description} class="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>—</option>{#each slot.grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
              </label>
              <label class="text-xs">Date format
                <select bind:value={slot.dateFormat} class="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value="iso">Year first</option><option value="us">Month first</option><option value="eu">Day first</option></select>
              </label>
              <label class="text-xs">Decimal
                <select bind:value={slot.decimal} class="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value=".">Dot</option><option value=",">Comma</option></select>
              </label>
            </div>
          </div>
        {/if}
        {#if slot.error}<div class="p-3 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-xs text-[color:var(--color-danger)]">{slot.error}</div>{/if}
      </div>
    {/each}
  </div>

  <!-- Match settings -->
  {#if A.grid && B.grid}
    <div class="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <p class="text-sm font-semibold">Match when</p>
      <label class="text-sm flex items-center gap-2">amount within
        <select bind:value={amountTolerance} class="px-2 py-1 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={0}>exact</option><option value={0.01}>1 cent</option><option value={0.05}>5 cents</option><option value={1}>1.00</option></select>
      </label>
      <label class="text-sm flex items-center gap-2">date within
        <select bind:value={dateToleranceDays} class="px-2 py-1 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={0}>same day</option><option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option></select>
      </label>
      <label class="text-sm flex items-center gap-2">currency
        <input bind:value={sym} maxlength="3" class="w-14 px-2 py-1 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm" />
      </label>
    </div>
  {/if}

  {#if !result}
    <p class="text-sm text-[color:var(--color-text-mute)]">Load both files and map a <strong>Date</strong> and an amount column in each to compare them.</p>
  {:else}
    <!-- Summary + view toggle -->
    <div class="grid grid-cols-3 gap-3">
      <button class="p-4 rounded-xl border text-left transition-colors {view === 'matched' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'}" on:click={() => (view = 'matched')}>
        <p class="text-xs text-[color:var(--color-text-mute)] mb-1">Matched</p>
        <p class="text-xl font-bold text-[color:var(--color-success)]">{result.matched.length}</p>
      </button>
      <button class="p-4 rounded-xl border text-left transition-colors {view === 'onlyA' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'}" on:click={() => (view = 'onlyA')}>
        <p class="text-xs text-[color:var(--color-text-mute)] mb-1">Only in List A</p>
        <p class="text-xl font-bold {result.onlyA.length ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-text)]'}">{result.onlyA.length}</p>
        <p class="text-[11px] text-[color:var(--color-text-dim)] mt-0.5">{signed(sumAmount(result.onlyA))}</p>
      </button>
      <button class="p-4 rounded-xl border text-left transition-colors {view === 'onlyB' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'}" on:click={() => (view = 'onlyB')}>
        <p class="text-xs text-[color:var(--color-text-mute)] mb-1">Only in List B</p>
        <p class="text-xl font-bold {result.onlyB.length ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-text)]'}">{result.onlyB.length}</p>
        <p class="text-[11px] text-[color:var(--color-text-dim)] mt-0.5">{signed(sumAmount(result.onlyB))}</p>
      </button>
    </div>

    <!-- Result table -->
    <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead><tr class="bg-[color:var(--color-surface-2)]">
            <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Date</th>
            <th class="text-right px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Amount</th>
            <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Description</th>
          </tr></thead>
          <tbody>
            {#each viewRows.slice(0, 50) as t}
              <tr class="border-b border-[color:var(--color-border)] last:border-0">
                <td class="px-3 py-1.5 whitespace-nowrap font-mono text-[color:var(--color-text-mute)]">{t.date}</td>
                <td class="px-3 py-1.5 text-right whitespace-nowrap font-mono {t.amount < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-success)]'}">{signed(t.amount)}</td>
                <td class="px-3 py-1.5 text-[color:var(--color-text-mute)] max-w-[360px] overflow-hidden text-ellipsis whitespace-nowrap">{t.description}</td>
              </tr>
            {/each}
            {#if viewRows.length === 0}
              <tr><td colspan="3" class="px-3 py-4 text-center text-[color:var(--color-text-mute)]">Nothing here — everything in this list was matched.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
      {#if viewRows.length > 50}<p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing 50 of {viewRows.length}. The export has all of them.</p>{/if}
    </div>

    <!-- Multi-format export -->
    {#if viewRows.length}
      <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
        <p class="text-sm font-semibold mb-1">Export {view === 'matched' ? 'matched' : view === 'onlyA' ? '“only in List A”' : '“only in List B”'} ({viewRows.length})</p>
        <p class="text-xs text-[color:var(--color-text-mute)] mb-3">Pick the format your accounting software imports.</p>
        <div class="flex flex-wrap gap-2">
          {#each EXPORT_FORMATS as f}
            <button class="px-3 py-2 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-brand-500)] hover:text-[color:var(--color-brand-400)] text-sm inline-flex items-center gap-1.5 transition-colors" on:click={() => download(f.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {f.label}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
