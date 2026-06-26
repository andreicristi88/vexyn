<script lang="ts">
  import { onMount } from 'svelte';

  let PDFLib: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let pageCount = $state(0);
  let text = $state('CONFIDENTIAL');
  let position = $state<'center' | 'top' | 'bottom' | 'topleft' | 'topright' | 'bottomleft' | 'bottomright'>('center');
  let opacity = $state(0.3);
  let fontSize = $state(60);
  let rotation = $state(45);
  let color = $state('#888888');
  let working = $state(false);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('watermarked.pdf');
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
    downloadName = f.name.replace(/\.pdf$/i, '') + '.watermarked.pdf';
    while (!ready && !error) {
      await new Promise((r) => setTimeout(r, 50));
    }
    try {
      const buf = await f.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
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
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) pickFile(f);
  }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }

  function hexToRgb(hex: string): [number, number, number] {
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m) return [0.5, 0.5, 0.5];
    return [parseInt(m[0], 16) / 255, parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255];
  }

  async function apply() {
    if (!file || !ready || !text.trim()) return;
    working = true;
    error = '';
    revoke();
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
      const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const pages = doc.getPages();
      const [r, g, b] = hexToRgb(color);

      for (const p of pages) {
        const { width, height } = p.getSize();
        const txt = text;
        const textW = font.widthOfTextAtSize(txt, fontSize);
        const textH = font.heightAtSize(fontSize);

        let x = 0, y = 0;
        switch (position) {
          case 'center': x = (width - textW) / 2; y = (height - textH) / 2; break;
          case 'top': x = (width - textW) / 2; y = height - textH - 30; break;
          case 'bottom': x = (width - textW) / 2; y = 30; break;
          case 'topleft': x = 30; y = height - textH - 30; break;
          case 'topright': x = width - textW - 30; y = height - textH - 30; break;
          case 'bottomleft': x = 30; y = 30; break;
          case 'bottomright': x = width - textW - 30; y = 30; break;
        }

        p.drawText(txt, {
          x, y, font, size: fontSize,
          color: PDFLib.rgb(r, g, b),
          opacity,
          rotate: position === 'center' ? PDFLib.degrees(rotation) : PDFLib.degrees(0),
        });
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      downloadUrl = URL.createObjectURL(blob);
    } catch (e: any) {
      error = `Watermark failed: ${e?.message ?? e}`;
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
      <label class="text-sm block">
        <span class="font-semibold block mb-2">Watermark text</span>
        <input type="text" bind:value={text} maxlength="80" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]" />
      </label>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label class="text-sm">
          <span class="font-semibold block mb-1">Position</span>
          <select bind:value={position} class="w-full px-2 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
            <option value="center">Center (diagonal)</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="topleft">Top-left</option>
            <option value="topright">Top-right</option>
            <option value="bottomleft">Bottom-left</option>
            <option value="bottomright">Bottom-right</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="font-semibold block mb-1">Color</span>
          <input type="color" bind:value={color} class="w-full h-10 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] cursor-pointer" />
        </label>
        <label class="text-sm">
          <span class="font-semibold block mb-1">Size: {fontSize}pt</span>
          <input type="range" min="20" max="120" step="5" bind:value={fontSize} class="w-full" />
        </label>
        <label class="text-sm">
          <span class="font-semibold block mb-1">Opacity: {Math.round(opacity * 100)}%</span>
          <input type="range" min="0.1" max="1" step="0.05" bind:value={opacity} class="w-full" />
        </label>
      </div>

      <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={apply} disabled={working || !text.trim()}>
        {working ? 'Applying…' : 'Add watermark'}
      </button>
    </div>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="font-semibold">Watermark applied.</p>
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
