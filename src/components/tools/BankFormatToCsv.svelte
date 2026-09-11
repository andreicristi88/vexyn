<script lang="ts">
  import { readMt940, mt940RowsOf, MT940_HEADERS } from '../../lib/mt940';
  import { readCamt, camtRowsOf, CAMT_HEADERS } from '../../lib/camt';
  import { serializeCsv } from '../../lib/csv';

  /** Which reader this page is for. The dropzone copy and file filter follow. */
  let { format }: { format: 'mt940' | 'camt' } = $props();

  const spec = {
    mt940: {
      label: 'MT940',
      accept: '.sta,.mt940,.940,.txt,.swi,text/plain',
      hint: 'Drop an MT940 file here (.sta, .940, .mt940 or .txt), or',
      note: 'SWIFT MT940 as banks send it: German structured details, the Dutch /TAG/ form, and plain text all read. Multi-page statements are joined.',
      read: (t: string) => { const r = readMt940(t); return { rows: mt940RowsOf(r), headers: MT940_HEADERS, accounts: r.accounts.map((a) => `${a.account}${a.currency ? ' (' + a.currency + ')' : ''}`), warnings: r.warnings, n: r.txns.length }; },
    },
    camt: {
      label: 'CAMT.053',
      accept: '.xml,.camt,.camt053,text/xml,application/xml',
      hint: 'Drop a camt.053 XML file here (camt.052 and camt.054 read too), or',
      note: 'ISO 20022 bank-to-customer statements. Batch bookings are expanded to one row per transaction; the counterparty is the creditor for money out and the debtor for money in.',
      read: (t: string) => { const r = readCamt(t); return { rows: camtRowsOf(r), headers: CAMT_HEADERS, accounts: r.accounts.map((a) => `${a.account}${a.currency ? ' (' + a.currency + ')' : ''}`), warnings: r.warnings, n: r.txns.length }; },
    },
  }[format];

  let fileName = $state('');
  let result = $state<{ rows: string[][]; headers: string[]; accounts: string[]; warnings: string[]; n: number } | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let copied = $state(false);
  /** A column no row uses is one more thing to explain away in an import mapping. */
  let hideEmpty = $state(true);

  let fileInput: HTMLInputElement;

  const keep = $derived(result ? result.headers.map((_, i) => !hideEmpty || result!.rows.some((r) => r[i] !== '')) : []);
  const headers = $derived(result ? result.headers.filter((_, i) => keep[i]) : []);
  const rows = $derived(result ? result.rows.map((r) => r.filter((_, i) => keep[i])) : []);
  const csv = $derived(headers.length ? serializeCsv({ headers, rows, delimiter: ',', hadBom: false }, ',') : '');

  function loadText(text: string, name: string) {
    error = ''; copied = false;
    result = spec.read(text);
    fileName = name;
  }
  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB — far past any real statement. Check it is the right file.'; return; }
    loadText(await f.text(), f.name);
  }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }

  function download() {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (fileName.replace(/\.[^.]+$/, '') || 'statement') + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyCsv() {
    try { await navigator.clipboard.writeText(csv); copied = true; setTimeout(() => (copied = false), 1500); } catch {}
  }
  function reset() { result = null; fileName = ''; error = ''; }
</script>

<div class="space-y-4">
  {#if !result}
    <div class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="{spec.label} drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">{spec.hint}</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept={spec.accept} class="hidden" on:change={onPick} />
      <p class="text-xs text-[color:var(--color-text-dim)] mt-4 max-w-xl mx-auto">{spec.note}</p>
    </div>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}

  {#if result}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm">
        <p class="font-medium text-[color:var(--color-text)]">{fileName}</p>
        <p class="text-xs text-[color:var(--color-text-mute)]">
          {result.n} transaction{result.n === 1 ? '' : 's'}
          {#if result.accounts.length}· {result.accounts.length} account{result.accounts.length === 1 ? '' : 's'}: {result.accounts.join(', ')}{/if}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs text-[color:var(--color-text-mute)]"><input type="checkbox" bind:checked={hideEmpty} class="rounded" />Hide empty columns</label>
        <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
      </div>
    </div>

    {#if result.warnings.length}
      <div class="p-4 rounded-lg bg-[color:var(--color-warning)]/10 border border-[color:var(--color-warning)]/30 text-sm space-y-1.5">
        {#each result.warnings as w}<p class="text-[color:var(--color-text-mute)]">{w}</p>{/each}
      </div>
    {/if}

    {#if rows.length}
      <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
        <div class="overflow-x-auto max-h-[440px]">
          <table class="w-full text-sm">
            <thead class="bg-[color:var(--color-surface-2)] sticky top-0"><tr>{#each headers as h}<th class="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>{/each}</tr></thead>
            <tbody>
              {#each rows.slice(0, 100) as r}
                <tr class="border-t border-[color:var(--color-border)]">{#each r as c}<td class="px-3 py-1.5 whitespace-nowrap text-[color:var(--color-text-mute)]">{c}</td>{/each}</tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if rows.length > 100}<p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing 100 of {rows.length}. The download has all of them.</p>{/if}
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2" on:click={download}>
          Download CSV
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium" on:click={copyCsv}>{copied ? 'Copied!' : 'Copy'}</button>
        <a href="/csv-to-excel" class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium inline-flex items-center">Need .xlsx? Convert the CSV →</a>
      </div>
    {/if}
  {/if}
</div>
