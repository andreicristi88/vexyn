<script lang="ts">
  import { onMount } from 'svelte';

  let PDFLib: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let pageCount = $state(0);
  let top = $state(5);
  let right = $state(5);
  let bottom = $state(5);
  let left = $state(5);
  let unit = $state<'pct' | 'pt'>('pct');
  let working = $state(false);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('cropped.pdf');
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      PDFLib = await import('pdf-lib');
      ready = true;
    } catch (e: any) {
      error = `Could not load PDF engine: ${e?.message ?? e}`;
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
    downloadName = f.name.replace(/\.pdf$/i, '') + '.cropped.pdf';
    while (!ready && !error) await new Promise((r) => setTimeout(r, 50));
    try {
      const doc = await PDFLib.PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: false });
      pageCount = doc.getPageCount();
    } catch (e: any) {
      error = e?.message?.includes('encrypted') ? 'Encrypted PDF — unlock it first.' : 'Could not read this PDF.';
      file = null;
    }
  }

  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.[0]) pickFile(t.files[0]);
    t.value = '';
  }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) pickFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }

  async function crop() {
    if (!file || !ready) return;
    working = true;
    error = '';
    revoke();
    try {
      const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
      const pages = doc.getPages();
      for (const p of pages) {
        const { width, height } = p.getSize();
        const t = unit === 'pct' ? (top / 100) * height : top;
        const r = unit === 'pct' ? (right / 100) * width : right;
        const bt = unit === 'pct' ? (bottom / 100) * height : bottom;
        const l = unit === 'pct' ? (left / 100) * width : left;
        // pdf-lib coords: origin bottom-left
        const cropX = l;
        const cropY = bt;
        const cropW = Math.max(1, width - l - r);
        const cropH = Math.max(1, height - t - bt);
        // Set both MediaBox (visible page) and CropBox so viewers honor it
        p.setMediaBox(cropX, cropY, cropW, cropH);
        const cropBox = doc.context.obj([cropX, cropY, cropX + cropW, cropY + cropH]);
        p.node.set(PDFLib.PDFName.of('CropBox'), cropBox);
      }
      const bytes = await doc.save();
      downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    } catch (e: any) {
      error = `Crop failed: ${e?.message ?? e}`;
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
      <button class="mt-2 text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={reset}>Choose a different file</button>
    {/if}
  </div>

  {#if file && !downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
      <div>
        <p class="text-sm font-semibold mb-2">Trim from each side</p>
        <div class="grid grid-cols-4 gap-3">
          <label class="text-sm">
            <span class="block mb-1 text-[color:var(--color-text-mute)]">Top</span>
            <input type="number" bind:value={top} min="0" class="w-full px-2 py-1.5 rounded bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]" />
          </label>
          <label class="text-sm">
            <span class="block mb-1 text-[color:var(--color-text-mute)]">Right</span>
            <input type="number" bind:value={right} min="0" class="w-full px-2 py-1.5 rounded bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]" />
          </label>
          <label class="text-sm">
            <span class="block mb-1 text-[color:var(--color-text-mute)]">Bottom</span>
            <input type="number" bind:value={bottom} min="0" class="w-full px-2 py-1.5 rounded bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]" />
          </label>
          <label class="text-sm">
            <span class="block mb-1 text-[color:var(--color-text-mute)]">Left</span>
            <input type="number" bind:value={left} min="0" class="w-full px-2 py-1.5 rounded bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]" />
          </label>
        </div>
      </div>

      <div>
        <p class="text-sm font-semibold mb-2">Unit</p>
        <div class="grid grid-cols-2 gap-2">
          <label class="block p-3 rounded-lg border cursor-pointer text-sm {unit === 'pct' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)]'}">
            <input type="radio" bind:group={unit} value="pct" class="sr-only" />Percent of page
          </label>
          <label class="block p-3 rounded-lg border cursor-pointer text-sm {unit === 'pt' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)]'}">
            <input type="radio" bind:group={unit} value="pt" class="sr-only" />Points (1pt = 1/72 inch)
          </label>
        </div>
      </div>

      <p class="text-xs text-[color:var(--color-text-mute)]">
        Same crop applies to every page. Content outside the crop is hidden but stays in the PDF — viewers honour the cropbox.
      </p>

      <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={crop} disabled={working}>
        {working ? 'Cropping…' : 'Crop PDF'}
      </button>
    </div>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="font-semibold">Cropped.</p>
      <a href={downloadUrl} download={downloadName} class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2 whitespace-nowrap">
        Download
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}
</div>
