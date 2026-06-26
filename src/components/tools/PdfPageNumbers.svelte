<script lang="ts">
  import { onMount } from 'svelte';

  let PDFLib: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let pageCount = $state(0);
  let format = $state<'plain' | 'of' | 'page'>('plain');
  let position = $state<'br' | 'bl' | 'tr' | 'tl' | 'tc' | 'bc'>('br');
  let fontSize = $state(12);
  let color = $state('#222222');
  let startNumber = $state(1);
  let skipFirst = $state(false);
  let prefix = $state('');
  let working = $state(false);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('numbered.pdf');
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
    downloadName = f.name.replace(/\.pdf$/i, '') + '.numbered.pdf';
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

  function hexToRgb(hex: string): [number, number, number] {
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m) return [0.2, 0.2, 0.2];
    return [parseInt(m[0], 16) / 255, parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255];
  }

  function buildLabel(i: number, total: number): string {
    let s = format === 'plain' ? `${i}` : format === 'of' ? `${i} / ${total}` : `Page ${i} of ${total}`;
    if (prefix) s = `${prefix} ${s}`;
    return s;
  }

  async function apply() {
    if (!file || !ready) return;
    working = true;
    error = '';
    revoke();
    try {
      const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
      const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      const pages = doc.getPages();
      const [r, g, b] = hexToRgb(color);
      const startIdx = skipFirst ? 1 : 0;
      const numberedTotal = pages.length - startIdx;

      for (let i = startIdx; i < pages.length; i++) {
        const label = buildLabel(startNumber + (i - startIdx), numberedTotal);
        const p = pages[i];
        const { width, height } = p.getSize();
        const textW = font.widthOfTextAtSize(label, fontSize);
        const margin = 30;
        let x = 0, y = 0;
        switch (position) {
          case 'br': x = width - textW - margin; y = margin; break;
          case 'bl': x = margin; y = margin; break;
          case 'tr': x = width - textW - margin; y = height - fontSize - margin; break;
          case 'tl': x = margin; y = height - fontSize - margin; break;
          case 'tc': x = (width - textW) / 2; y = height - fontSize - margin; break;
          case 'bc': x = (width - textW) / 2; y = margin; break;
        }
        p.drawText(label, { x, y, font, size: fontSize, color: PDFLib.rgb(r, g, b) });
      }

      const bytes = await doc.save();
      downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    } catch (e: any) {
      error = `Failed: ${e?.message ?? e}`;
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
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label class="text-sm">
          <span class="font-semibold block mb-1">Format</span>
          <select bind:value={format} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
            <option value="plain">1</option>
            <option value="of">1 / N</option>
            <option value="page">Page 1 of N</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="font-semibold block mb-1">Position</span>
          <select bind:value={position} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
            <option value="br">Bottom-right</option>
            <option value="bl">Bottom-left</option>
            <option value="bc">Bottom-center</option>
            <option value="tr">Top-right</option>
            <option value="tl">Top-left</option>
            <option value="tc">Top-center</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="font-semibold block mb-1">Color</span>
          <input type="color" bind:value={color} class="w-full h-10 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] cursor-pointer" />
        </label>
        <label class="text-sm">
          <span class="font-semibold block mb-1">Size: {fontSize}pt</span>
          <input type="range" min="8" max="32" step="1" bind:value={fontSize} class="w-full" />
        </label>
        <label class="text-sm">
          <span class="font-semibold block mb-1">Start at</span>
          <input type="number" bind:value={startNumber} min="1" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]" />
        </label>
        <label class="text-sm">
          <span class="font-semibold block mb-1">Prefix (optional)</span>
          <input type="text" bind:value={prefix} maxlength="20" placeholder="e.g. Chapter 1 —" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]" />
        </label>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={skipFirst} class="rounded" />
        <span>Skip first page (don't number the cover)</span>
      </label>

      <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={apply} disabled={working}>
        {working ? 'Applying…' : 'Add page numbers'}
      </button>
    </div>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="font-semibold">Page numbers added.</p>
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
