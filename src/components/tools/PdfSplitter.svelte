<script lang="ts">
  import { onMount } from 'svelte';

  let PDFLib: any = $state(null);
  let JSZip: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let pageCount = $state(0);
  let mode = $state<'each' | 'range'>('each');
  let rangeStr = $state('1-3, 5');
  let splitting = $state(false);
  let progress = $state(0);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('split.zip');
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      [PDFLib, { default: JSZip }] = await Promise.all([
        import('pdf-lib'),
        import('jszip'),
      ]);
      ready = true;
    } catch (e: any) {
      error = `Could not load engines: ${e?.message ?? e}`;
      console.error('[PdfSplitter] init failed', e);
    }
  });

  async function pickFile(f: File) {
    revoke();
    error = '';
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) {
      error = 'Drop a PDF (.pdf).';
      return;
    }
    file = f;
    pageCount = 0;
    while (!PDFLib && !error) {
      await new Promise((r) => setTimeout(r, 50));
    }
    try {
      const buf = await f.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
      pageCount = doc.getPageCount();
    } catch (e: any) {
      error = e?.message?.includes('encrypted')
        ? 'Encrypted PDF — remove password first.'
        : 'Could not read this PDF.';
      console.error('[PdfSplitter] read failed', e);
      file = null;
    }
  }

  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.[0]) pickFile(t.files[0]);
    t.value = '';
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) pickFile(f);
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function parseRange(input: string, max: number): number[] {
    const out = new Set<number>();
    for (const part of input.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const m = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        if (a > 0 && b >= a) {
          for (let i = a; i <= Math.min(b, max); i++) out.add(i);
        }
      } else {
        const n = parseInt(trimmed, 10);
        if (n > 0 && n <= max) out.add(n);
      }
    }
    return [...out].sort((a, b) => a - b);
  }

  async function split() {
    if (!file || !PDFLib) return;
    splitting = true;
    progress = 0;
    error = '';
    revoke();

    try {
      const buf = await file.arrayBuffer();
      const src = await PDFLib.PDFDocument.load(buf);
      const total = src.getPageCount();

      if (mode === 'each') {
        const zip = new JSZip();
        for (let i = 0; i < total; i++) {
          const out = await PDFLib.PDFDocument.create();
          const [p] = await out.copyPages(src, [i]);
          out.addPage(p);
          const bytes = await out.save();
          zip.file(`page-${String(i + 1).padStart(3, '0')}.pdf`, bytes);
          progress = Math.round(((i + 1) / total) * 100);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadUrl = URL.createObjectURL(blob);
        downloadName = file.name.replace(/\.pdf$/i, '') + '-split.zip';
      } else {
        const indices1 = parseRange(rangeStr, total);
        if (indices1.length === 0) {
          throw new Error('Range is empty or invalid. Example: 1-3, 5, 7-9');
        }
        const out = await PDFLib.PDFDocument.create();
        const indices0 = indices1.map((n) => n - 1);
        const pages = await out.copyPages(src, indices0);
        pages.forEach((p: any) => out.addPage(p));
        progress = 90;
        const bytes = await out.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        downloadUrl = URL.createObjectURL(blob);
        downloadName = file.name.replace(/\.pdf$/i, '') + `-pages-${rangeStr.replace(/[\s,]+/g, '_')}.pdf`;
        progress = 100;
      }
    } catch (e: any) {
      error = e?.message ?? 'Split failed.';
      console.error('[PdfSplitter] split failed', e);
    } finally {
      splitting = false;
    }
  }

  function revoke() {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      downloadUrl = '';
    }
  }

  function clear() {
    file = null;
    pageCount = 0;
    error = '';
    revoke();
  }

  function fmtSize(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }
</script>

<button
  type="button"
  onclick={() => fileInput?.click()}
  ondrop={onDrop}
  ondragover={onDragOver}
  ondragleave={() => dragOver = false}
  class={[
    'w-full p-10 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer',
    dragOver
      ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5'
      : 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-500)]/5'
  ]}
>
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[color:var(--color-text-mute)]">
    <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>
  </svg>
  <div class="text-center">
    <p class="font-medium text-[color:var(--color-text)]">
      {dragOver ? 'Drop your PDF' : file ? 'Drop another to replace' : 'Drop a PDF here or click to browse'}
    </p>
    <p class="text-xs text-[color:var(--color-text-mute)] mt-1">
      Single PDF input. Output: ZIP of single-page files or one merged range.
    </p>
  </div>
  <input bind:this={fileInput} type="file" accept="application/pdf,.pdf" onchange={onPick} class="hidden" />
</button>

{#if !ready && !error}
  <p class="mt-4 text-sm text-[color:var(--color-text-dim)] text-center">Loading PDF engine…</p>
{/if}

{#if file && pageCount > 0}
  <div class="mt-6 flex items-center gap-3 p-3 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
    <div class="w-8 h-8 rounded bg-[color:var(--color-brand-500)]/10 border border-[color:var(--color-brand-500)]/30 flex items-center justify-center text-[10px] font-mono text-[color:var(--color-brand-400)]">PDF</div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium truncate">{file.name}</p>
      <p class="text-xs text-[color:var(--color-text-mute)]">{fmtSize(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p>
    </div>
    <button onclick={clear} aria-label="Clear" class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]">Clear</button>
  </div>

  <div class="mt-4 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-xs font-medium text-[color:var(--color-text-mute)] uppercase tracking-wider w-20">Mode</span>
      <div class="flex p-0.5 rounded-md bg-[color:var(--color-bg)] border border-[color:var(--color-border)]">
        <button
          onclick={() => mode = 'each'}
          class={[
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            mode === 'each' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
          ]}
        >Split each page (ZIP)</button>
        <button
          onclick={() => mode = 'range'}
          class={[
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            mode === 'range' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
          ]}
        >Extract range</button>
      </div>
    </div>

    {#if mode === 'range'}
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-xs font-medium text-[color:var(--color-text-mute)] uppercase tracking-wider w-20">Pages</span>
        <input
          type="text"
          bind:value={rangeStr}
          placeholder="e.g. 1-3, 5, 7-9"
          class="flex-1 min-w-[200px] px-3 py-2 rounded bg-[color:var(--color-bg)] border border-[color:var(--color-border)] text-sm font-mono text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-dim)] focus:border-[color:var(--color-brand-500)] focus:outline-none"
        />
        <span class="text-xs text-[color:var(--color-text-dim)]">Total {pageCount} pages</span>
      </div>
    {/if}
  </div>

  <div class="mt-4 flex flex-wrap items-center gap-3">
    <button
      onclick={split}
      disabled={splitting || !ready}
      class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {#if splitting}
        <span class="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
        Splitting… {progress}%
      {:else}
        {mode === 'each' ? 'Split into ZIP' : 'Extract pages'}
      {/if}
    </button>

    {#if downloadUrl}
      <a
        href={downloadUrl}
        download={downloadName}
        class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium transition-opacity flex items-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download {downloadName}
      </a>
    {/if}
  </div>
{/if}

{#if error}
  <div class="mt-4 p-3 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
{/if}
