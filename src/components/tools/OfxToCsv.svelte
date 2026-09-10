<script lang="ts">
  import { readOfx, ofxRowsOf, OFX_READ_HEADERS, type OfxReadResult } from '../../lib/ofx';
  import { serializeCsv } from '../../lib/csv';

  let fileName = $state('');
  let result = $state<OfxReadResult | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let copied = $state(false);
  /**
   * A statement that never used check numbers still has a Check number column,
   * and an empty column in an import mapping is one more thing to explain away.
   * On by default, off in one click when the blanks are meaningful.
   */
  let hideEmpty = $state(true);

  let fileInput: HTMLInputElement;

  const allRows = $derived(result ? ofxRowsOf(result) : []);
  const keep = $derived(
    OFX_READ_HEADERS.map((_, i) => !hideEmpty || allRows.some((r) => r[i] !== '')),
  );
  const headers = $derived(OFX_READ_HEADERS.filter((_, i) => keep[i]));
  const rows = $derived(allRows.map((r) => r.filter((_, i) => keep[i])));
  const csv = $derived(headers.length ? serializeCsv({ headers, rows, delimiter: ',', hadBom: false }, ',') : '');

  function loadText(text: string, name: string) {
    error = '';
    copied = false;
    const r = readOfx(text);
    if (r.txns.length === 0) {
      // Still show it: the warnings are the whole answer when nothing was read.
      result = r;
      fileName = name;
      return;
    }
    result = r;
    fileName = name;
  }

  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) {
      error = 'File is larger than 50 MB. That is far past any real statement — check it is the right file.';
      return;
    }
    loadText(await f.text(), f.name);
  }
  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.[0]) handleFile(t.files[0]);
    t.value = '';
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function download() {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'statement') + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyCsv() {
    try {
      await navigator.clipboard.writeText(csv);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {}
  }
  function reset() {
    result = null;
    fileName = '';
    error = '';
  }
</script>

<div class="space-y-4">
  {#if !result}
    <div
      class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="OFX drop zone">
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop an OFX, QFX or QBO file here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".ofx,.qfx,.qbo,.qfx2,text/plain" class="hidden" on:change={onPick} />
      <p class="text-xs text-[color:var(--color-text-dim)] mt-4">Both OFX 1.x (SGML) and OFX 2.x (XML) are read, along with credit-card statements.</p>
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
          {result.txns.length} transaction{result.txns.length === 1 ? '' : 's'}
          {#if result.accounts.length}
            · {result.accounts.length} account{result.accounts.length === 1 ? '' : 's'}: {result.accounts.map((a) => `${a.acctId}${a.currency ? ' (' + a.currency + ')' : ''}`).join(', ')}
          {/if}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs text-[color:var(--color-text-mute)]"><input type="checkbox" bind:checked={hideEmpty} class="rounded" />Hide empty columns</label>
        <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
      </div>
    </div>

    {#if result.warnings.length}
      <div class="p-4 rounded-lg bg-[color:var(--color-warning)]/10 border border-[color:var(--color-warning)]/30 text-sm space-y-1.5">
        {#each result.warnings as w}
          <p class="text-[color:var(--color-text-mute)]">{w}</p>
        {/each}
      </div>
    {/if}

    {#if rows.length}
      <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
        <div class="overflow-x-auto max-h-[440px]">
          <table class="w-full text-sm">
            <thead class="bg-[color:var(--color-surface-2)] sticky top-0">
              <tr>{#each headers as h}<th class="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>{/each}</tr>
            </thead>
            <tbody>
              {#each rows.slice(0, 100) as r}
                <tr class="border-t border-[color:var(--color-border)]">
                  {#each r as c}<td class="px-3 py-1.5 whitespace-nowrap text-[color:var(--color-text-mute)]">{c}</td>{/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if rows.length > 100}
          <p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing 100 of {rows.length}. The download has all of them.</p>
        {/if}
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2" on:click={download}>
          Download CSV
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium" on:click={copyCsv}>{copied ? 'Copied!' : 'Copy'}</button>
        <a href="/csv-to-excel" class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium inline-flex items-center">Need .xlsx? Convert the CSV →</a>
      </div>
      <p class="text-xs text-[color:var(--color-text-mute)]">
        Amounts are written exactly as the file had them, and dates as the day the bank posted them — no timezone is applied, so a transaction cannot slide into the wrong month.
      </p>
    {/if}
  {/if}
</div>
