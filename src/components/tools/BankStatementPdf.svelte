<script lang="ts">
  import { serializeCsv, type Grid } from '../../lib/csv';
  import {
    buildLines,
    parseStatement,
    detectDecimal,
    type PdfTextItem,
    type PdfLine,
    type ParseResult,
  } from '../../lib/pdf';
  // The worker is emitted as an asset and served from this origin, so the
  // site's CSP (worker-src 'self' blob:) covers it. Only the URL is imported
  // eagerly — a string — while pdf.js itself is pulled in on first use.
  import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

  let fileName = $state('');
  let error = $state('');
  let busy = $state(false);
  let progress = $state('');
  let dragOver = $state(false);
  let copied = $state(false);

  let result = $state<ParseResult | null>(null);
  let decimal = $state<'.' | ','>('.');
  /** What each detected money column actually is — the reader's call, not ours. */
  let roles = $state<string[]>([]);

  let fileInput: HTMLInputElement;
  const PREVIEW = 12;
  const ROLE_OPTIONS = ['Amount', 'Debit', 'Credit', 'Balance', 'Fee', 'Ignore'];

  const outGrid = $derived.by<Grid | null>(() => {
    if (!result) return null;
    const keep = roles.map((r, i) => (r === 'Ignore' ? -1 : i)).filter((i) => i >= 0);
    const headers = ['Date', 'Description', ...keep.map((i) => roles[i])];
    const rows = result.grid.rows.map((r) => [r[0], r[1], ...keep.map((i) => r[2 + i] ?? '')]);
    return { headers, rows, delimiter: ',', hadBom: false };
  });

  async function handleFile(f: File) {
    error = '';
    result = null;
    if (f.size > 50 * 1024 * 1024) {
      error = 'File is larger than 50 MB.';
      return;
    }
    busy = true;
    progress = 'Reading the PDF…';
    try {
      const pdfjs: any = await import('pdfjs-dist/build/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const buf = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;

      const pages: PdfTextItem[][] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        progress = `Reading page ${n} of ${doc.numPages}…`;
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .filter((it: any) => typeof it.str === 'string')
            .map((it: any) => ({
              str: it.str,
              x: it.transform[4],
              y: it.transform[5],
              width: it.width ?? 0,
            })),
        );
      }

      const lines = buildLines(pages);
      decimal = detectDecimal(lines);
      const parsed = parseStatement(lines);
      result = parsed;
      roles = defaultRoles(parsed);
      fileName = f.name;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/password/i.test(msg)) {
        error =
          'This PDF is password-protected. Open it in a PDF reader, save an unprotected copy, and try again — the password is never sent anywhere, so it cannot be handled here.';
      } else {
        error = `Could not read this PDF: ${msg}`;
      }
      console.error('[BankStatementPdf] failed', e);
    } finally {
      busy = false;
      progress = '';
    }
  }

  /**
   * A first guess at what each money column is, by position: the rightmost is
   * almost always the running balance, and two columns before it are Debit and
   * Credit. It is only a guess — the selects above the table are what decide.
   */
  function defaultRoles(r: ParseResult): string[] {
    const n = r.amountColumns;
    if (n === 1) return ['Amount'];
    if (n === 2) return ['Amount', 'Balance'];
    if (n === 3) return ['Debit', 'Credit', 'Balance'];
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? 'Balance' : `Amount`));
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
  function reset() {
    result = null;
    fileName = '';
    error = '';
  }

  function download() {
    if (!outGrid) return;
    const blob = new Blob(['﻿' + serializeCsv(outGrid, ',')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'statement') + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyCsv() {
    if (!outGrid) return;
    try {
      await navigator.clipboard.writeText(serializeCsv(outGrid, ','));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {}
  }
</script>

<div class="space-y-4">
  {#if !result}
    <div
      class="dropzone-tint border-2 border-dashed rounded-xl p-10 text-center {dragOver
        ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5'
        : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver}
      on:dragleave={() => (dragOver = false)}
      on:drop={onDrop}
      role="region"
      aria-label="PDF drop zone"
    >
      <svg class="mx-auto mb-4 h-11 w-11 text-[color:var(--color-text-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/></svg>
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop your bank statement PDF here, or</p>
      <button
        class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors disabled:opacity-50"
        disabled={busy}
        on:click={() => fileInput.click()}>{busy ? 'Working…' : 'Choose file'}</button
      >
      <input bind:this={fileInput} type="file" accept=".pdf,application/pdf" class="hidden" on:change={onPick} />
      <p class="text-xs text-[color:var(--color-text-dim)] mt-3">
        Text-based statements, as downloaded from your bank. Scans and photos need OCR and will not work.
      </p>
    </div>
  {/if}

  {#if busy}
    <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-sm text-[color:var(--color-text-mute)]">
      {progress || 'Working…'}
    </div>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}

  {#if result}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm">
        <p class="font-medium">{fileName}</p>
        <p class="text-xs text-[color:var(--color-text-mute)]">
          {result.stats.pages} page{result.stats.pages !== 1 ? 's' : ''} · {result.stats.transactions} transaction{result.stats.transactions !== 1 ? 's' : ''} ·
          {result.stats.continuations} wrapped line{result.stats.continuations !== 1 ? 's' : ''} joined ·
          {result.stats.ignored} line{result.stats.ignored !== 1 ? 's' : ''} skipped · decimal “{decimal}”
        </p>
      </div>
      <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
    </div>

    {#each result.warnings as w}
      <div class="p-3 rounded-lg bg-[color:var(--color-accent-500)]/10 border border-[color:var(--color-accent-500)]/30 text-sm text-[color:var(--color-text-mute)]">{w}</div>
    {/each}

    {#if result.amountColumns > 0}
      <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
        <p class="text-sm font-semibold mb-1">What is in each money column?</p>
        <p class="text-xs text-[color:var(--color-text-mute)] mb-3">
          Columns are read from where the numbers line up on the page. Name them yourself — guessing which one is the balance is how a converter quietly corrupts a statement.
        </p>
        <div class="flex flex-wrap gap-3">
          {#each roles as _, i}
            <label class="text-sm">
              <span class="font-medium block mb-1">Column {i + 1}</span>
              <select bind:value={roles[i]} class="px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
                {#each ROLE_OPTIONS as o}<option value={o}>{o}</option>{/each}
              </select>
            </label>
          {/each}
        </div>
      </div>
    {/if}

    {#if outGrid && outGrid.rows.length}
      <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead><tr class="bg-[color:var(--color-surface-2)]">
              {#each outGrid.headers as h}<th class="text-left px-3 py-2 font-semibold whitespace-nowrap border-b border-[color:var(--color-border)]">{h}</th>{/each}
            </tr></thead>
            <tbody>
              {#each outGrid.rows.slice(0, PREVIEW) as row}
                <tr class="border-b border-[color:var(--color-border)] last:border-0">
                  {#each row as c, ci}
                    <td class="px-3 py-1.5 whitespace-nowrap max-w-[320px] overflow-hidden text-ellipsis {ci >= 2 ? 'font-mono text-right' : 'text-[color:var(--color-text-mute)]'}">{c}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if outGrid.rows.length > PREVIEW}
          <p class="px-3 py-2 text-xs text-[color:var(--color-text-dim)] bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">Showing {PREVIEW} of {outGrid.rows.length} rows. The download has all of them.</p>
        {/if}
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2" on:click={download}>
          Download CSV
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium" on:click={copyCsv}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>

      <p class="text-xs text-[color:var(--color-text-dim)]">
        Check a few rows against the PDF before you rely on this — especially the first and last transaction, and any row where the description wrapped. Then take the CSV to the
        <a href="/bank-statement-analyzer" class="text-[color:var(--color-brand-400)] hover:underline">Bank Statement Analyzer</a>,
        <a href="/spending-analyzer" class="text-[color:var(--color-brand-400)] hover:underline">Spending Analyzer</a> or
        <a href="/csv-to-qbo" class="text-[color:var(--color-brand-400)] hover:underline">CSV to QBO</a>.
      </p>
    {/if}

    <details class="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <summary class="px-4 py-3 text-sm font-medium cursor-pointer select-none">
        Every line the PDF gave up ({result.lines.length}) — open this if a row looks wrong
      </summary>
      <div class="px-4 pb-4">
        <pre class="overflow-auto max-h-[360px] text-xs font-mono text-[color:var(--color-text-mute)] whitespace-pre-wrap">{result.lines.map((l: PdfLine) => `p${l.page}  ${l.text}`).join('\n')}</pre>
      </div>
    </details>
  {/if}
</div>
