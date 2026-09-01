<script lang="ts">
  import { parseCsv, type Grid } from '../../lib/csv';
  import {
    buildTransactions,
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
  let windowDays = $state(3);

  let fileInput: HTMLInputElement;

  const ready = $derived(
    !!grid && map.date >= 0 && map.description >= 0 &&
      (map.amountMode === 'single' ? map.amount >= 0 : map.debit >= 0 || map.credit >= 0),
  );
  const result = $derived(grid && ready ? buildTransactions(grid.rows, map, dateFormat, decimal) : null);
  const dups = $derived(result ? findDuplicateCharges(result.txns, windowDays) : []);
  const extraTotal = $derived(round2(dups.reduce((s, g) => s + (g.count - 1) * Math.abs(g.amount), 0)));

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
        <label class="text-sm">
          <span class="font-medium block mb-1">Date *</span>
          <select bind:value={map.date} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {map.date < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm">
            <option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </label>
        {#if map.amountMode === 'single'}
          <label class="text-sm">
            <span class="font-medium block mb-1">Amount *</span>
            <select bind:value={map.amount} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {map.amount < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm">
              <option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
            </select>
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
        <label class="text-sm">
          <span class="font-medium block mb-1">Description / Merchant *</span>
          <select bind:value={map.description} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {map.description < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm">
            <option value={-1}>— choose —</option>{#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </label>
        <label class="text-sm">
          <span class="font-medium block mb-1">Date format</span>
          <select bind:value={dateFormat} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value="iso">Year first (2026-01-31)</option><option value="us">Month first (01/31/2026)</option><option value="eu">Day first (31/01/2026)</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="font-medium block mb-1">Decimal separator</span>
          <select bind:value={decimal} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value=".">Dot (1,234.56)</option><option value=",">Comma (1.234,56)</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="font-medium block mb-1">Within</span>
          <select bind:value={windowDays} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="font-medium block mb-1">Currency symbol</span>
          <input bind:value={sym} maxlength="3" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm" />
        </label>
      </div>
    </div>

    {#if !ready}
      <p class="text-sm text-[color:var(--color-text-mute)]">Choose a <strong>Date</strong>, an amount, and the <strong>Description</strong> column to scan for double charges.</p>
    {:else if result}
      {#if result.skipped.length}
        <div class="p-3 rounded-lg bg-[color:var(--color-accent-500)]/10 border border-[color:var(--color-accent-500)]/30 text-xs text-[color:var(--color-text-mute)]">{result.skipped.length} row{result.skipped.length !== 1 ? 's' : ''} skipped (unreadable date or amount). Check the date format and decimal separator above.</div>
      {/if}

      {#if dups.length === 0}
        <div class="p-6 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-center">
          <p class="text-[color:var(--color-text-mute)]">No suspected double charges within {windowDays} day{windowDays !== 1 ? 's' : ''}. Widen the window above if you want to look further apart.</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-3">
          <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
            <p class="text-xs text-[color:var(--color-text-mute)] mb-1">Suspected groups</p>
            <p class="text-xl font-bold">{dups.length}</p>
          </div>
          <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
            <p class="text-xs text-[color:var(--color-text-mute)] mb-1">In the extra copies</p>
            <p class="text-xl font-bold text-[color:var(--color-danger)]">{money(extraTotal)}</p>
          </div>
        </div>

        <div class="rounded-xl border border-[color:var(--color-border)] divide-y divide-[color:var(--color-border)] overflow-hidden">
          {#each dups as g}
            <div class="flex items-start gap-3 p-4 bg-[color:var(--color-surface)]">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium truncate">{g.merchant}</span>
                  <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[color:var(--color-danger)]/12 text-[color:var(--color-danger)] border border-[color:var(--color-danger)]/25">{g.count}× same charge</span>
                </div>
                <p class="text-xs text-[color:var(--color-text-mute)] mt-1">{g.dates.join(' · ')}{g.spanDays > 0 ? ` (${g.spanDays} day${g.spanDays !== 1 ? 's' : ''} apart)` : ' (same day)'}</p>
              </div>
              <p class="font-mono text-sm text-[color:var(--color-danger)] whitespace-nowrap">{money(g.amount)}</p>
            </div>
          {/each}
        </div>
        <p class="text-xs text-[color:var(--color-text-dim)]">These are suspected double charges — same merchant, same amount, close together. Some are legitimate (a coffee bought twice, two identical tickets). Check each against your statement before disputing.</p>
      {/if}
    {/if}
  {/if}
</div>
