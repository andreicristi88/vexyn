<script lang="ts">
  import { parseCsv, type Grid } from '../../lib/csv';
  import {
    buildTransactions,
    totals,
    cashFlowByMonth,
    byMerchant,
    detectRecurring,
    findDuplicateCharges,
    round2,
    DEFAULT_MAP,
    type StatementMap,
    type DateFormat,
  } from '../../lib/statement';

  let fileName = $state('');
  let hasHeader = $state(true);
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);

  let map = $state<StatementMap>({ ...DEFAULT_MAP });
  let dateFormat = $state<DateFormat>('iso');
  let decimal = $state<'.' | ','>('.');
  let sym = $state('$');

  let fileInput: HTMLInputElement;

  const ready = $derived(
    !!grid && map.date >= 0 && map.description >= 0 &&
      (map.amountMode === 'single' ? map.amount >= 0 : map.debit >= 0 || map.credit >= 0),
  );
  const result = $derived(grid && ready ? buildTransactions(grid.rows, map, dateFormat, decimal) : null);
  const sums = $derived(result ? totals(result.txns) : null);
  const months = $derived(result ? cashFlowByMonth(result.txns) : []);
  const topSpend = $derived(result ? byMerchant(result.txns, 'out').slice(0, 8) : []);
  const spendMax = $derived(topSpend.reduce((m, r) => Math.max(m, Math.abs(r.total)), 0) || 1);
  const subs = $derived(result ? detectRecurring(result.txns, 'out') : []);
  const subsMonthly = $derived(round2(subs.reduce((s, r) => s + r.monthlyCost, 0)));
  const dups = $derived(result ? findDuplicateCharges(result.txns, 3) : []);
  const chartMax = $derived(months.reduce((m, r) => Math.max(m, r.in, r.out), 0) || 1);

  function guess(headers: string[], patterns: RegExp[]): number {
    for (let i = 0; i < headers.length; i++) if (patterns.some((p) => p.test(headers[i].toLowerCase()))) return i;
    return -1;
  }
  function autoConfigure(g: Grid) {
    const debit = guess(g.headers, [/debit|paid out|withdrawal|money out|\bout\b|\bdr\b/]);
    const credit = guess(g.headers, [/credit|paid in|deposit|money in|\bin\b|\bcr\b/]);
    const amount = guess(g.headers, [/amount|value|total|sum/]);
    const useSplit = debit >= 0 && credit >= 0 && amount < 0;
    map = { ...DEFAULT_MAP, amountMode: useSplit ? 'split' : 'single', date: guess(g.headers, [/date|posted|time/]), amount, debit, credit, description: guess(g.headers, [/desc|payee|name|merchant|details|narrative|reference|memo/]) };
    if (map.date >= 0) { const s = g.rows.map((r) => r[map.date]).find((v) => v && v.trim()); if (s) { const first = s.trim().split(/[\/.\-]/)[0]; if (first && first.length === 4) dateFormat = 'iso'; else { const c = s.trim().split(/[\/.\-]/).map((x) => parseInt(x, 10)); dateFormat = c[0] > 12 ? 'eu' : c[1] > 12 ? 'us' : 'us'; } } }
    const amtCol = useSplit ? (debit >= 0 ? debit : credit) : amount;
    if (amtCol >= 0) { const s = g.rows.map((r) => r[amtCol]).find((v) => v && /\d/.test(v)); if (s) decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'; }
  }
  function loadText(text: string, name: string) { error = ''; const res = parseCsv(text, hasHeader); if (!res.ok) { error = res.error; grid = null; return; } grid = res.grid; fileName = name; autoConfigure(res.grid); }
  async function handleFile(f: File) { if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB.'; return; } loadText(await f.text(), f.name); }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function reset() { grid = null; fileName = ''; error = ''; }
  function money(n: number): string { return sym + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(n: number): string { return (n < 0 ? '−' : '+') + money(n); }
  function monthLabel(m: string): string { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); }

  const CH = { w: 720, h: 200, padL: 8, padR: 8, padT: 12, padB: 24 };
  const plotW = CH.w - CH.padL - CH.padR;
  const plotH = CH.h - CH.padT - CH.padB;
  const slot = $derived(months.length ? plotW / months.length : plotW);
  const bw = $derived(Math.min(16, slot / 3));
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop your bank statement CSV here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
      <label class="flex items-center justify-center gap-1.5 text-xs text-[color:var(--color-text-mute)] mt-4"><input type="checkbox" bind:checked={hasHeader} class="rounded" />First row is a header</label>
    </div>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}

  {#if grid}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm">
        <p class="font-medium text-[color:var(--color-text)]">{fileName}</p>
        <p class="text-xs text-[color:var(--color-text-mute)]">{grid.headers.length} columns · {grid.rows.length} rows</p>
      </div>
      <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
    </div>

    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
      <div class="flex flex-wrap items-center gap-3 justify-between">
        <p class="text-sm font-semibold">Map your columns</p>
        <div class="inline-flex rounded-lg border border-[color:var(--color-border)] overflow-hidden text-xs">
          <button class="px-3 py-1.5 {map.amountMode === 'single' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)]'}" on:click={() => (map.amountMode = 'single')}>One amount column</button>
          <button class="px-3 py-1.5 {map.amountMode === 'split' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)]'}" on:click={() => (map.amountMode = 'split')}>Separate debit / credit</button>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label class="text-sm"><span class="font-medium block mb-1">Date *</span>
          <select bind:value={map.date} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {map.date < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm"><option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
        </label>
        {#if map.amountMode === 'single'}
          <label class="text-sm"><span class="font-medium block mb-1">Amount *</span>
            <select bind:value={map.amount} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {map.amount < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm"><option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
            <label class="flex items-center gap-1.5 text-xs text-[color:var(--color-text-mute)] mt-1.5"><input type="checkbox" bind:checked={map.debitsArePositive} class="rounded" />Spending shows as a positive number</label>
          </label>
        {:else}
          <label class="text-sm"><span class="font-medium block mb-1">Money out (debit)</span>
            <select bind:value={map.debit} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>— none —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
          </label>
          <label class="text-sm"><span class="font-medium block mb-1">Money in (credit)</span>
            <select bind:value={map.credit} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm"><option value={-1}>— none —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
          </label>
        {/if}
        <label class="text-sm"><span class="font-medium block mb-1">Description / Merchant *</span>
          <select bind:value={map.description} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {map.description < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm"><option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}</select>
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

    {#if !ready}
      <p class="text-sm text-[color:var(--color-text-mute)]">Choose a <strong>Date</strong>, an amount, and the <strong>Description</strong> column to build your overview.</p>
    {:else if sums && result}
      {#if result.skipped.length}
        <div class="p-3 rounded-lg bg-[color:var(--color-accent-500)]/10 border border-[color:var(--color-accent-500)]/30 text-xs text-[color:var(--color-text-mute)]">{result.skipped.length} row{result.skipped.length !== 1 ? 's' : ''} skipped (unreadable date or amount). Check the date format and decimal separator above.</div>
      {/if}

      <!-- Summary -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Money in</p><p class="text-xl font-bold text-[color:var(--color-success)]">{money(sums.moneyIn)}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Money out</p><p class="text-xl font-bold text-[color:var(--color-danger)]">{money(sums.moneyOut)}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Net</p><p class="text-xl font-bold {sums.net < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-text)]'}">{signed(sums.net)}</p></div>
        <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Transactions</p><p class="text-xl font-bold">{sums.count}</p><p class="text-[11px] text-[color:var(--color-text-dim)] mt-0.5">{sums.from} → {sums.to}</p></div>
      </div>

      <!-- Cash flow chart -->
      {#if months.length}
        <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm font-semibold">In vs out by month</p>
            <div class="flex items-center gap-4 text-xs text-[color:var(--color-text-mute)]">
              <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[color:var(--color-success)]"></span>In</span>
              <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[color:var(--color-danger)]"></span>Out</span>
              <a href="/cash-flow-analyzer" class="text-[color:var(--color-brand-400)] hover:underline">Details →</a>
            </div>
          </div>
          <div class="overflow-x-auto">
            <svg viewBox="0 0 {CH.w} {CH.h}" class="w-full" style="min-width:{Math.max(360, months.length * 52)}px" role="img" aria-label="Monthly money in versus money out">
              <line x1={CH.padL} y1={CH.padT + plotH} x2={CH.w - CH.padR} y2={CH.padT + plotH} stroke="var(--color-border)" stroke-width="1" />
              {#each months as m, i}
                {@const cx = CH.padL + slot * i + slot / 2}
                {@const inH = (m.in / chartMax) * plotH}
                {@const outH = (m.out / chartMax) * plotH}
                <rect x={cx - bw - 2} y={CH.padT + plotH - inH} width={bw} height={Math.max(0, inH)} rx="2" fill="var(--color-success)"><title>{monthLabel(m.month)} · in {money(m.in)}</title></rect>
                <rect x={cx + 2} y={CH.padT + plotH - outH} width={bw} height={Math.max(0, outH)} rx="2" fill="var(--color-danger)"><title>{monthLabel(m.month)} · out {money(m.out)}</title></rect>
                <text x={cx} y={CH.h - 6} text-anchor="middle" font-size="11" fill="var(--color-text-mute)">{monthLabel(m.month)}</text>
              {/each}
            </svg>
          </div>
        </div>
      {/if}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Top spending -->
        {#if topSpend.length}
          <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
            <div class="flex items-center justify-between mb-4"><p class="text-sm font-semibold">Top spending</p><a href="/merchant-analyzer" class="text-xs text-[color:var(--color-brand-400)] hover:underline">All merchants →</a></div>
            <div class="space-y-2.5">
              {#each topSpend as r}
                <div>
                  <div class="flex items-baseline justify-between gap-3 mb-1"><span class="text-sm font-medium truncate">{r.merchant}</span><span class="text-sm font-mono text-[color:var(--color-danger)] whitespace-nowrap">{money(r.total)}</span></div>
                  <div class="h-2 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden"><div class="h-full rounded-full bg-[color:var(--color-danger)]" style="width:{Math.max(2, (Math.abs(r.total) / spendMax) * 100)}%"></div></div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Flags: subscriptions + duplicates -->
        <div class="space-y-4">
          <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
            <div class="flex items-center justify-between mb-2"><p class="text-sm font-semibold">Recurring charges</p><a href="/subscription-finder" class="text-xs text-[color:var(--color-brand-400)] hover:underline">Details →</a></div>
            {#if subs.length}
              <p class="text-sm text-[color:var(--color-text-mute)]"><span class="text-lg font-bold text-[color:var(--color-text)]">{subs.length}</span> found · about <span class="font-semibold text-[color:var(--color-danger)]">{money(subsMonthly)}</span>/month</p>
              <div class="mt-3 space-y-1.5">
                {#each subs.slice(0, 4) as s}
                  <div class="flex items-center justify-between text-xs"><span class="truncate text-[color:var(--color-text)]">{s.merchant}</span><span class="font-mono text-[color:var(--color-text-mute)] whitespace-nowrap">{money(s.amount)}</span></div>
                {/each}
                {#if subs.length > 4}<p class="text-xs text-[color:var(--color-text-dim)]">+{subs.length - 4} more</p>{/if}
              </div>
            {:else}
              <p class="text-sm text-[color:var(--color-text-mute)]">None detected in this range.</p>
            {/if}
          </div>

          <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
            <div class="flex items-center justify-between mb-2"><p class="text-sm font-semibold">Possible double charges</p><a href="/duplicate-transaction-finder" class="text-xs text-[color:var(--color-brand-400)] hover:underline">Details →</a></div>
            {#if dups.length}
              <p class="text-sm text-[color:var(--color-text-mute)]"><span class="text-lg font-bold text-[color:var(--color-text)]">{dups.length}</span> suspected group{dups.length !== 1 ? 's' : ''} to review (same merchant &amp; amount within 3 days).</p>
            {:else}
              <p class="text-sm text-[color:var(--color-text-mute)]">None within 3 days.</p>
            {/if}
          </div>
        </div>
      </div>

      <p class="text-xs text-[color:var(--color-text-dim)]">An overview built entirely from the rows you mapped — the totals are exact sums; the recurring and duplicate flags are best-effort suggestions to review. Open any panel’s “details” for the full breakdown.</p>
    {/if}
  {/if}
</div>
