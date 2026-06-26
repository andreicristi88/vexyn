<script lang="ts">
  import { onMount } from 'svelte';

  let PDFLib: any = $state(null);
  let pdfjsLib: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let originalSize = $state(0);
  let pageCount = $state(0);
  let mode = $state<'strong' | 'text'>('strong');
  let quality = $state(0.6);
  let working = $state(false);
  let progress = $state(0);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('compressed.pdf');
  let compressedSize = $state(0);
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      PDFLib = await import('pdf-lib');
      pdfjsLib = await import('pdfjs-dist');
      const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      ready = true;
    } catch (e: any) {
      error = `Could not load engines: ${e?.message ?? e}`;
      console.error('[PdfCompressor] init failed', e);
    }
  });

  function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  async function pickFile(f: File) {
    revoke();
    error = '';
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) {
      error = 'Drop a PDF (.pdf).';
      return;
    }
    file = f;
    originalSize = f.size;
    compressedSize = 0;
    pageCount = 0;
    downloadName = f.name.replace(/\.pdf$/i, '') + '.compressed.pdf';
    while (!ready && !error) {
      await new Promise((r) => setTimeout(r, 50));
    }
    try {
      const buf = await f.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
      pageCount = doc.getPageCount();
    } catch (e: any) {
      error = e?.message?.includes('encrypted')
        ? 'Encrypted PDF — unlock it first.'
        : 'Could not read this PDF.';
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

  async function compress() {
    if (!file || !ready) return;
    working = true;
    progress = 0;
    error = '';
    revoke();
    try {
      const buf = await file.arrayBuffer();
      let outBytes: Uint8Array;

      if (mode === 'text') {
        // Light: re-save through pdf-lib with object stream optimization. Modest reduction; preserves text.
        const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
        outBytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
        progress = 100;
      } else {
        // Strong: render every page as JPEG at chosen quality, rebuild PDF from images.
        // Loses searchable text. Big size reduction for image-heavy PDFs.
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const out = await PDFLib.PDFDocument.create();
        const total = pdf.numPages;

        for (let i = 1; i <= total; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;

          const blob: Blob = await new Promise((r) =>
            canvas.toBlob((b) => r(b!), 'image/jpeg', quality)
          );
          const jpgBytes = new Uint8Array(await blob.arrayBuffer());
          const img = await out.embedJpg(jpgBytes);
          const p = out.addPage([viewport.width, viewport.height]);
          p.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });

          canvas.width = 0;
          canvas.height = 0;
          progress = Math.round((i / total) * 100);
        }
        outBytes = await out.save({ useObjectStreams: true });
      }

      const out = new Blob([outBytes], { type: 'application/pdf' });
      compressedSize = out.size;
      downloadUrl = URL.createObjectURL(out);
    } catch (e: any) {
      error = `Compression failed: ${e?.message ?? e}`;
      console.error('[PdfCompressor] failed', e);
    } finally {
      working = false;
    }
  }

  function revoke() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = '';
  }

  function reset() {
    revoke();
    file = null;
    originalSize = 0;
    compressedSize = 0;
    pageCount = 0;
    error = '';
  }
</script>

<div class="space-y-4">
  <div
    class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
    on:dragover={onDragOver}
    on:dragleave={() => (dragOver = false)}
    on:drop={onDrop}
    role="region"
    aria-label="PDF drop zone"
  >
    {#if !file}
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a PDF here, or</p>
      <button
        class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors"
        on:click={() => fileInput.click()}
      >
        Choose PDF
      </button>
      <input bind:this={fileInput} type="file" accept="application/pdf,.pdf" class="hidden" on:change={onPick} />
    {:else}
      <p class="font-medium text-[color:var(--color-text)] mb-1">{file.name}</p>
      <p class="text-xs text-[color:var(--color-text-mute)]">{pageCount} pages · {fmtBytes(originalSize)}</p>
      <button class="mt-3 text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={reset}>Choose a different file</button>
    {/if}
  </div>

  {#if file && !downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
      <div>
        <p class="text-sm font-semibold mb-2">Compression mode</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label class="block p-3 rounded-lg border cursor-pointer transition-colors {mode === 'strong' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]'}">
            <input type="radio" bind:group={mode} value="strong" class="sr-only" />
            <p class="font-medium text-sm">Strong</p>
            <p class="text-xs text-[color:var(--color-text-mute)] mt-1">Re-renders pages as JPEG. 60-90% smaller. Text becomes non-selectable.</p>
          </label>
          <label class="block p-3 rounded-lg border cursor-pointer transition-colors {mode === 'text' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]'}">
            <input type="radio" bind:group={mode} value="text" class="sr-only" />
            <p class="font-medium text-sm">Keep text</p>
            <p class="text-xs text-[color:var(--color-text-mute)] mt-1">Stream re-deflate. 10-30% smaller. Text stays searchable.</p>
          </label>
        </div>
      </div>

      {#if mode === 'strong'}
        <div>
          <label class="text-sm font-semibold mb-2 block">Image quality: <span class="text-[color:var(--color-brand-400)]">{Math.round(quality * 100)}%</span></label>
          <input type="range" min="0.3" max="0.95" step="0.05" bind:value={quality} class="w-full" />
          <p class="text-xs text-[color:var(--color-text-mute)] mt-1">Lower = smaller file, more visible artifacts. 60% is a sweet spot.</p>
        </div>
      {/if}

      <button
        class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={compress}
        disabled={working}
      >
        {working ? `Compressing… ${progress}%` : 'Compress PDF'}
      </button>
    </div>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <p class="font-semibold text-[color:var(--color-text)]">Compressed!</p>
        <p class="text-sm text-[color:var(--color-text-mute)]">
          {fmtBytes(originalSize)} → <strong class="text-[color:var(--color-success)]">{fmtBytes(compressedSize)}</strong>
          <span class="ml-1">({Math.round((1 - compressedSize / originalSize) * 100)}% smaller)</span>
        </p>
      </div>
      <a href={downloadUrl} download={downloadName} class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium transition-opacity inline-flex items-center gap-2 whitespace-nowrap">
        Download
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}
</div>
