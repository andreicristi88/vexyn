<script lang="ts">
  import { parseCsv, type Grid } from '../../lib/csv';
  import { rowsToTxns, buildOfx, type ColumnMap, type DateFormat, type OfxAccount } from '../../lib/ofx';

  // 'ofx' or 'qbo' — the only difference is the Intuit tags + file extension.
  let { format = 'ofx' as 'ofx' | 'qbo' } = $props();

  let fileName = $state('');
  let hasHeader = $state(true);
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let built = $state(false);

  let map = $state<ColumnMap>({ date: -1, amount: -1, name: -1, memo: -1, fitid: -1 });
  let dateFormat = $state<DateFormat>('iso');
  let decimal = $state<'.' | ','>('.');

  let acctId = $state('');
  let bankId = $state('');
  let acctType = $state<OfxAccount['acctType']>('CHECKING');
  let currency = $state('USD');
  let intuBid = $state('');

  let fileInput: HTMLInputElement;
  const PREVIEW = 8;

  const parsed = $derived(
    grid && map.date >= 0 && map.amount >= 0
      ? rowsToTxns(grid.rows, map, dateFormat, decimal)
      : null,
  );

  function guess(headers: string[], patterns: RegExp[]): number {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (patterns.some((p) => p.test(h))) return i;
    }
    return -1;
  }

  function autoConfigure(g: Grid) {
    map = {
      date: guess(g.headers, [/date|posted|time/]),
      amount: guess(g.headers, [/amount|value|total|debit|credit|sum/]),
      name: guess(g.headers, [/desc|payee|name|merchant|details|narrative|reference/]),
      memo: guess(g.headers, [/memo|note|category/]),
      fitid: guess(g.headers, [/\bid\b|transaction id|txn|reference number/]),
    };
    // Guess date format + decimal from a sample of the mapped columns.
    if (map.date >= 0) {
      const sample = g.rows.map((r) => r[map.date]).find((v) => v && v.trim());
      if (sample) {
        const first = sample.trim().split(/[\/.\-]/)[0];
        if (first && first.length === 4) dateFormat = 'iso';
        else {
          const comps = sample.trim().split(/[\/.\-]/).map((x) => parseInt(x, 10));
          if (comps[0] > 12) dateFormat = 'eu';
          else if (comps[1] > 12) dateFormat = 'us';
          else dateFormat = 'us';
        }
      }
    }
    if (map.amount >= 0) {
      const sample = g.rows.map((r) => r[map.amount]).find((v) => v && /\d/.test(v));
      if (sample) {
        const lastComma = sample.lastIndexOf(',');
        const lastDot = sample.lastIndexOf('.');
        decimal = lastComma > lastDot ? ',' : '.';
      }
    }
  }

  function loadText(text: string, name: string) {
    error = '';
    built = false;
    const res = parseCsv(text, hasHeader);
    if (!res.ok) { error = res.error; grid = null; return; }
    grid = res.grid;
    fileName = name;
    autoConfigure(res.grid);
  }
  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB.'; return; }
    loadText(await f.text(), f.name);
  }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function reparse() { if (grid && fileName) { /* header toggle needs original text; only for file re-read */ } }
  function reset() { grid = null; fileName = ''; error = ''; built = false; }

  function fmtAmount(n: number) { return (n < 0 ? '' : '+') + n.toFixed(2); }
  function fmtDate(ymd: string) { return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`; }

  function build() {
    if (!parsed || parsed.txns.length === 0) return;
    if (!acctId.trim()) { error = 'Enter an account number (or any identifier) — the file needs one.'; return; }
    error = '';
    const account: OfxAccount = {
      bankId: bankId.trim() || '0000',
      acctId: acctId.trim(),
      acctType,
      currency: currency.trim().toUpperCase() || 'USD',
    };
    const doc = buildOfx(parsed.txns, account, {
      qbo: format === 'qbo',
      intuBid: intuBid.trim() || undefined,
    });
    const ext = format === 'qbo' ? 'qbo' : 'ofx';
    const mime = format === 'qbo' ? 'application/vnd.intu.qbo' : 'application/x-ofx';
    const blob = new Blob([doc], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'transactions') + '.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    built = true;
  }

  const FIELD_DEFS: { key: keyof ColumnMap; label: string; required: boolean; hint: string }[] = [
    { key: 'date', label: 'Date', required: true, hint: 'When the transaction posted' },
    { key: 'amount', label: 'Amount', required: true, hint: 'Signed: negative = money out' },
    { key: 'name', label: 'Description / Payee', required: false, hint: 'Who / what' },
    { key: 'memo', label: 'Memo', required: false, hint: 'Extra note (optional)' },
    { key: 'fitid', label: 'Transaction ID', required: false, hint: 'Unique id (auto if empty)' },
  ];
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop your bank CSV here, or</p>
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

    <!-- Column mapping -->
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
      <p class="text-sm font-semibold">Map your columns</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each FIELD_DEFS as f}
          <label class="text-sm">
            <span class="font-medium block mb-1">{f.label}{f.required ? ' *' : ''}</span>
            <select bind:value={map[f.key]} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border {f.required && map[f.key] < 0 ? 'border-[color:var(--color-danger)]/50' : 'border-[color:var(--color-border)]'} text-sm">
              <option value={-1}>{f.required ? '— choose —' : '— none —'}</option>
              {#each grid.headers as h, i}<option value={i}>{h}</option>{/each}
            </select>
            <span class="text-xs text-[color:var(--color-text-dim)]">{f.hint}</span>
          </label>
        {/each}
        <label class="text-sm">
          <span class="font-medium block mb-1">Date format</span>
          <select bind:value={dateFormat} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value="iso">Year first (2026-01-31)</option>
            <option value="us">Month first (01/31/2026)</option>
            <option value="eu">Day first (31/01/2026)</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="font-medium block mb-1">Decimal separator</span>
          <select bind:value={decimal} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value=".">Dot (1,234.56)</option>
            <option value=",">Comma (1.234,56)</option>
          </select>
        </label>
      </div>
    </div>

    <!-- Account info -->
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-3">
      <p class="text-sm font-semibold">Account details</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label class="text-sm"><span class="font-medium block mb-1">Account number *</span><input bind:value={acctId} placeholder="e.g. 1234567890" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm" /></label>
        <label class="text-sm"><span class="font-medium block mb-1">Bank / routing ID</span><input bind:value={bankId} placeholder="optional" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm" /></label>
        <label class="text-sm"><span class="font-medium block mb-1">Account type</span>
          <select bind:value={acctType} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value="CHECKING">Checking</option><option value="SAVINGS">Savings</option><option value="CREDITLINE">Credit line</option><option value="MONEYMRKT">Money market</option>
          </select>
        </label>
        <label class="text-sm"><span class="font-medium block mb-1">Currency</span><input bind:value={currency} maxlength="3" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm uppercase" /></label>
        {#if format === 'qbo'}
          <label class="text-sm sm:col-span-2"><span class="font-medium block mb-1">Intuit Bank ID (INTU.BID)</span><input bind:value={intuBid} placeholder="optional — some QuickBooks versions require your bank's" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm" /></label>
        {/if}
      </div>
    </div>

    <!-- Preview + validation -->
    {#if parsed}
      <div class="p-3 rounded-lg {parsed.errors.length ? 'bg-[color:var(--color-accent-500)]/10 border-[color:var(--color-accent-500)]/30' : 'bg-[color:var(--color-success)]/10 border-[color:var(--color-success)]/30'} border text-sm text-[color:var(--color-text)]">
        {parsed.txns.length} transaction{parsed.txns.length !== 1 ? 's' : ''} ready.
        {#if parsed.errors.length}
          <span class="text-[color:var(--color-text-mute)]"> {parsed.errors.length} row{parsed.errors.length !== 1 ? 's' : ''} skipped —</span>
          {#each parsed.errors.slice(0, 3) as e}<span class="text-xs block text-[color:var(--color-text-mute)]">row {e.row}: {e.reason}</span>{/each}
          {#if parsed.errors.length > 3}<span class="text-xs text-[color:var(--color-text-dim)]">…and {parsed.errors.length - 3} more. Check the date format and decimal separator above.</span>{/if}
        {/if}
      </div>

      <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead><tr class="bg-[color:var(--color-surface-2)]">
              <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Date</th>
              <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Amount</th>
              <th class="text-left px-3 py-2 font-semibold border-b border-[color:var(--color-border)]">Description</th>
            </tr></thead>
            <tbody>
              {#each parsed.txns.slice(0, PREVIEW) as t}
                <tr class="border-b border-[color:var(--color-border)] last:border-0">
                  <td class="px-3 py-1.5 text-[color:var(--color-text-mute)] whitespace-nowrap font-mono">{fmtDate(t.datePosted)}</td>
                  <td class="px-3 py-1.5 whitespace-nowrap font-mono {t.amount < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-success)]'}">{fmtAmount(t.amount)}</td>
                  <td class="px-3 py-1.5 text-[color:var(--color-text-mute)] max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">{t.name}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if parsed.txns.length > PREVIEW}
          <p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing {PREVIEW} of {parsed.txns.length}. Check the dates and signs look right before downloading.</p>
        {/if}
      </div>

      <div class="flex items-center gap-3">
        <button class="px-5 py-3 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2 disabled:opacity-50" on:click={build} disabled={parsed.txns.length === 0}>
          Download .{format}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        {#if built}<span class="text-sm text-[color:var(--color-success)]">Downloaded.</span>{/if}
      </div>
    {:else}
      <p class="text-sm text-[color:var(--color-text-mute)]">Choose a <strong>Date</strong> and an <strong>Amount</strong> column above to continue.</p>
    {/if}
  {/if}
</div>
