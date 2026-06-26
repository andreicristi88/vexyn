<script lang="ts">
  import { onMount } from 'svelte';

  let pdfjsLib: any = $state(null);
  let JSZip: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let pageCount = $state(0);
  let format = $state<'jpeg' | 'png' | 'webp'>('jpeg');
  let quality = $state(0.9);
  let scale = $state(2);
  let working = $state(false);
  let progress = $state(0);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('pages.zip');
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      pdfjsLib = await import('pdfjs-dist');
      const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      JSZip = (await import('jszip')).default;
      ready = true;
    } catch (e: any) {
      error = `Could not load engines: ${e?.message ?? e}`;
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
    downloadName = f.name.replace(/\.pdf$/i, '') + '.pages.zip';
    while (!ready && !error) {
      await new Promise((r) => setTimeout(r, 50));
    }
    try {
      const buf = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      pageCount = pdf.numPages;
    } catch (e: any) {
      error = 'Could not read this PDF.';
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
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }

  async function convert() {
    if (!file || !ready) return;
    working = true;
    progress = 0;
    error = '';
    revoke();
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const zip = new JSZip();
      const total = pdf.numPages;
      const mime = `image/${format}`;
      const ext = format === 'jpeg' ? 'jpg' : format;

      for (let i = 1; i <= total; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        const blob: Blob = await new Promise((r) =>
          canvas.toBlob((b) => r(b!), mime, format === 'png' ? undefined : quality)
        );
        zip.file(`page-${String(i).padStart(3, '0')}.${ext}`, blob);
        canvas.width = 0; canvas.height = 0;
        progress = Math.round((i / total) * 100);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadUrl = URL.createObjectURL(zipBlob);
    } catch (e: any) {
      error = `Conversion failed: ${e?.message ?? e}`;
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
    pageCount = 0;
    error = '';
  }
</script>

<div class="space-y-4">
  <div class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
    on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="PDF drop zone">
    {#if !file}
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a PDF here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium" on:click={() => fileInput.click()}>Choose PDF</button>
      <input bind:this={fileInput} type="file" accept="application/pdf,.pdf" class="hidden" on:change={onPick} />
    {:else}
      <p class="font-medium mb-1">{file.name}</p>
      <p class="text-xs text-[color:var(--color-text-mute)]">{pageCount} pages</p>
      <button class="mt-3 text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={reset}>Choose a different file</button>
    {/if}
  </div>

  {#if file && !downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label class="text-sm">
          <span class="font-semibold block mb-1">Format</span>
          <select bind:value={format} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
            <option value="jpeg">JPG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="font-semibold block mb-1">Scale (resolution)</span>
          <select bind:value={scale} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
            <option value={1}>1× (~72 DPI)</option>
            <option value={2}>2× (~144 DPI)</option>
            <option value={3}>3× (~216 DPI)</option>
            <option value={4}>4× (~288 DPI)</option>
          </select>
        </label>
        {#if format !== 'png'}
          <label class="text-sm">
            <span class="font-semibold block mb-1">Quality: {Math.round(quality * 100)}%</span>
            <input type="range" min="0.3" max="0.95" step="0.05" bind:value={quality} class="w-full" />
          </label>
        {/if}
      </div>

      <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={convert} disabled={working}>
        {working ? `Converting… ${progress}%` : `Convert ${pageCount} page${pageCount > 1 ? 's' : ''} to ${format.toUpperCase()}`}
      </button>
    </div>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="font-semibold">Pages converted into a ZIP.</p>
      <a href={downloadUrl} download={downloadName} class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2 whitespace-nowrap">
        Download ZIP
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}
</div>
