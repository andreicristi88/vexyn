<script lang="ts">
  import { onMount } from 'svelte';

  type Item = { id: string; file: File; url: string; w: number; h: number };

  let PDFLib: any = $state(null);
  let ready = $state(false);
  let items = $state<Item[]>([]);
  let pageSize = $state<'auto' | 'a4' | 'letter'>('auto');
  let orientation = $state<'auto' | 'portrait' | 'landscape'>('auto');
  let margin = $state(20);
  let working = $state(false);
  let progress = $state(0);
  let error = $state('');
  let downloadUrl = $state('');
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

  function uid() { return Math.random().toString(36).slice(2, 10); }

  async function addFiles(fl: FileList | File[]) {
    revoke();
    error = '';
    const arr = Array.from(fl).filter(f => /^image\/(jpeg|jpg|png)$/i.test(f.type) || /\.(jpe?g|png)$/i.test(f.name));
    if (arr.length === 0) {
      error = 'Drop JPG or PNG images.';
      return;
    }
    const loaded: Item[] = await Promise.all(arr.map(async (f) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      return { id: uid(), file: f, url, w: img.naturalWidth, h: img.naturalHeight };
    }));
    items = [...items, ...loaded];
  }

  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files) addFiles(t.files);
    t.value = '';
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }

  function remove(id: string) {
    const idx = items.findIndex((x) => x.id === id);
    if (idx === -1) return;
    URL.revokeObjectURL(items[idx].url);
    items = items.filter((x) => x.id !== id);
  }
  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === id);
    const j = idx + dir;
    if (idx === -1 || j < 0 || j >= items.length) return;
    const arr = [...items];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    items = arr;
  }

  async function build() {
    if (items.length === 0 || !ready) return;
    working = true;
    progress = 0;
    error = '';
    revoke();
    try {
      const doc = await PDFLib.PDFDocument.create();
      // A4 in points: 595x842; Letter: 612x792
      const sizes: Record<string, [number, number]> = { a4: [595, 842], letter: [612, 792] };
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const buf = new Uint8Array(await it.file.arrayBuffer());
        const isPng = /\.png$/i.test(it.file.name) || it.file.type === 'image/png';
        const img = isPng ? await doc.embedPng(buf) : await doc.embedJpg(buf);

        let pageW: number, pageH: number;
        if (pageSize === 'auto') {
          pageW = it.w;
          pageH = it.h;
          if (orientation === 'portrait' && pageW > pageH) [pageW, pageH] = [pageH, pageW];
          if (orientation === 'landscape' && pageH > pageW) [pageW, pageH] = [pageH, pageW];
        } else {
          [pageW, pageH] = sizes[pageSize];
          const portrait = orientation === 'portrait' || (orientation === 'auto' && it.h >= it.w);
          if (!portrait) [pageW, pageH] = [pageH, pageW];
        }

        const page = doc.addPage([pageW, pageH]);
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;
        const scale = Math.min(availW / it.w, availH / it.h);
        const drawW = it.w * scale;
        const drawH = it.h * scale;
        page.drawImage(img, { x: (pageW - drawW) / 2, y: (pageH - drawH) / 2, width: drawW, height: drawH });
        progress = Math.round(((i + 1) / items.length) * 100);
      }
      const bytes = await doc.save();
      downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    } catch (e: any) {
      error = `Build failed: ${e?.message ?? e}`;
    } finally {
      working = false;
    }
  }

  function revoke() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = '';
  }
  function clearAll() {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    items = [];
    revoke();
    error = '';
  }
</script>

<div class="space-y-4">
  <div class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
    on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="Image drop zone">
    <p class="text-[color:var(--color-text-mute)] mb-3">{items.length === 0 ? 'Drop JPG/PNG images, or' : 'Add more images, or'}</p>
    <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium" on:click={() => fileInput.click()}>Choose images</button>
    <input bind:this={fileInput} type="file" accept="image/jpeg,image/png" multiple class="hidden" on:change={onPick} />
  </div>

  {#if items.length > 0}
    <div class="space-y-2">
      {#each items as it, i (it.id)}
        <div class="flex items-center gap-3 p-3 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
          <img src={it.url} alt={it.file.name} class="w-12 h-12 object-cover rounded" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{it.file.name}</p>
            <p class="text-xs text-[color:var(--color-text-mute)]">{it.w}×{it.h}</p>
          </div>
          <button class="p-1.5 text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] disabled:opacity-30" on:click={() => move(it.id, -1)} disabled={i === 0} aria-label="Move up">↑</button>
          <button class="p-1.5 text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] disabled:opacity-30" on:click={() => move(it.id, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</button>
          <button class="p-1.5 text-[color:var(--color-text-mute)] hover:text-[color:var(--color-danger)]" on:click={() => remove(it.id)} aria-label="Remove">×</button>
        </div>
      {/each}
    </div>

    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label class="text-sm">
        <span class="font-semibold block mb-1">Page size</span>
        <select bind:value={pageSize} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
          <option value="auto">Auto (image size)</option>
          <option value="a4">A4</option>
          <option value="letter">Letter</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="font-semibold block mb-1">Orientation</span>
        <select bind:value={orientation} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
          <option value="auto">Auto</option>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="font-semibold block mb-1">Margin (pt)</span>
        <input type="number" bind:value={margin} min="0" max="100" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]" />
      </label>
    </div>

    <div class="flex gap-2">
      <button class="flex-1 px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={build} disabled={working}>
        {working ? `Building… ${progress}%` : `Build PDF from ${items.length} image${items.length > 1 ? 's' : ''}`}
      </button>
      <button class="px-4 py-3 rounded-lg border border-[color:var(--color-border)] text-sm" on:click={clearAll}>Clear</button>
    </div>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="font-semibold">PDF ready.</p>
      <a href={downloadUrl} download="images.pdf" class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2 whitespace-nowrap">
        Download
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}
</div>
