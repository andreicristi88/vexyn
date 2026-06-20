<script lang="ts">
  import { onMount } from 'svelte';

  type Item = {
    id: string;
    file: File;
    pageCount: number | null;
    error?: string;
  };

  let PDFLib: any = $state(null);
  let ready = $state(false);
  let items = $state<Item[]>([]);
  let merging = $state(false);
  let progress = $state(0);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('merged.pdf');
  let dragOver = $state(false);
  let dragIndex = $state<number | null>(null);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      PDFLib = await import('pdf-lib');
      ready = true;
    } catch (e: any) {
      error = `Could not load PDF engine: ${e?.message ?? e}`;
      console.error('[PdfMerger] import failed', e);
    }
  });

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function totalPages() {
    return items.reduce((s, it) => s + (it.pageCount ?? 0), 0);
  }

  async function addFiles(fileList: FileList | File[]) {
    revokeDownload();
    error = '';
    const arr = Array.from(fileList).filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (arr.length === 0) {
      error = 'Drop PDF files (.pdf).';
      return;
    }
    const newIds: string[] = arr.map(() => uid());
    const newItems: Item[] = arr.map((file, i) => ({ id: newIds[i], file, pageCount: null }));
    items = [...items, ...newItems];

    // Wait for the PDF engine if it hasn't loaded yet
    while (!PDFLib && !error) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!PDFLib) return;

    // Mutate via the proxied array (Svelte 5 $state) so reactivity fires.
    for (const id of newIds) {
      const idx0 = items.findIndex((x) => x.id === id);
      if (idx0 === -1) continue; // user removed it before we got here
      const file = items[idx0].file;
      try {
        const buf = await file.arrayBuffer();
        const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
        const idx = items.findIndex((x) => x.id === id);
        if (idx !== -1) items[idx].pageCount = doc.getPageCount();
      } catch (e: any) {
        const idx = items.findIndex((x) => x.id === id);
        if (idx === -1) continue;
        items[idx].pageCount = 0;
        items[idx].error = e?.message?.includes('encrypted')
          ? 'Encrypted PDF — remove password first.'
          : 'Could not read this PDF.';
        console.error('[PdfMerger] read failed', file.name, e);
      }
    }
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

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function remove(id: string) {
    items = items.filter(it => it.id !== id);
    revokeDownload();
  }

  function clearAll() {
    items = [];
    revokeDownload();
    error = '';
  }

  function move(id: string, dir: -1 | 1) {
    const i = items.findIndex(it => it.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    items = copy;
    revokeDownload();
  }

  // Native list drag-and-drop reorder
  function onItemDragStart(e: DragEvent, index: number) {
    dragIndex = index;
    e.dataTransfer?.setData('text/plain', String(index));
    e.dataTransfer && (e.dataTransfer.effectAllowed = 'move');
  }
  function onItemDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer && (e.dataTransfer.dropEffect = 'move');
  }
  function onItemDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    const from = dragIndex ?? Number(e.dataTransfer?.getData('text/plain'));
    dragIndex = null;
    if (!Number.isInteger(from) || from === dropIndex) return;
    const copy = [...items];
    const [moved] = copy.splice(from, 1);
    copy.splice(dropIndex, 0, moved);
    items = copy;
    revokeDownload();
  }

  function revokeDownload() {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      downloadUrl = '';
    }
  }

  async function merge() {
    if (!PDFLib) return;
    const usable = items.filter(it => (it.pageCount ?? 0) > 0);
    if (usable.length === 0) {
      error = 'Add at least one valid PDF.';
      return;
    }

    merging = true;
    progress = 0;
    error = '';
    revokeDownload();

    try {
      const out = await PDFLib.PDFDocument.create();
      let done = 0;
      for (const it of usable) {
        const buf = await it.file.arrayBuffer();
        const src = await PDFLib.PDFDocument.load(buf);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p: any) => out.addPage(p));
        done++;
        progress = Math.round((done / usable.length) * 100);
      }
      const bytes = await out.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      downloadUrl = URL.createObjectURL(blob);
      downloadName = usable.length === 1
        ? usable[0].file.name
        : `merged-${usable.length}-files.pdf`;
    } catch (e: any) {
      error = e?.message ?? 'Merge failed.';
      console.error('[PdfMerger] merge failed', e);
    } finally {
      merging = false;
    }
  }

  function fmtSize(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }
</script>

<!-- Drop zone -->
<button
  type="button"
  onclick={() => fileInput?.click()}
  ondrop={onDrop}
  ondragover={onDragOver}
  ondragleave={() => dragOver = false}
  class:list={[
    'w-full p-10 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer',
    dragOver
      ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5'
      : 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-500)]/5'
  ]}
>
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[color:var(--color-text-mute)]">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
  <div class="text-center">
    <p class="font-medium text-[color:var(--color-text)]">
      {dragOver ? 'Drop your PDFs' : 'Drop PDFs here or click to browse'}
    </p>
    <p class="text-xs text-[color:var(--color-text-mute)] mt-1">
      Multiple files supported. Files stay on your device.
    </p>
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept="application/pdf,.pdf"
    multiple
    onchange={onPick}
    class="hidden"
  />
</button>

{#if !ready && !error}
  <p class="mt-4 text-sm text-[color:var(--color-text-dim)] text-center">Loading PDF engine…</p>
{/if}

{#if items.length > 0}
  <div class="mt-6">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-semibold text-[color:var(--color-text-mute)]">
        {items.length} file{items.length === 1 ? '' : 's'} · {totalPages()} page{totalPages() === 1 ? '' : 's'} total
      </h2>
      <button onclick={clearAll} class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]">
        Clear all
      </button>
    </div>

    <ul class="space-y-2">
      {#each items as it, i (it.id)}
        <li
          draggable="true"
          ondragstart={(e) => onItemDragStart(e, i)}
          ondragover={onItemDragOver}
          ondrop={(e) => onItemDrop(e, i)}
          class="flex items-center gap-3 p-3 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] cursor-grab active:cursor-grabbing"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[color:var(--color-text-dim)] flex-shrink-0">
            <circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/>
            <circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>

          <div class="w-8 h-8 rounded bg-[color:var(--color-brand-500)]/10 border border-[color:var(--color-brand-500)]/30 flex items-center justify-center text-[10px] font-mono text-[color:var(--color-brand-400)] flex-shrink-0">
            PDF
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{it.file.name}</p>
            <p class="text-xs text-[color:var(--color-text-mute)]">
              {fmtSize(it.file.size)}
              {#if it.pageCount !== null}
                · {it.pageCount} page{it.pageCount === 1 ? '' : 's'}
              {:else}
                · reading…
              {/if}
              {#if it.error}
                · <span class="text-[color:var(--color-danger)]">{it.error}</span>
              {/if}
            </p>
          </div>

          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              onclick={() => move(it.id, -1)}
              disabled={i === 0}
              aria-label="Move up"
              class="w-8 h-8 rounded hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-text-mute)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button
              onclick={() => move(it.id, 1)}
              disabled={i === items.length - 1}
              aria-label="Move down"
              class="w-8 h-8 rounded hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-text-mute)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button
              onclick={() => remove(it.id)}
              aria-label="Remove"
              class="w-8 h-8 rounded hover:bg-[color:var(--color-danger)]/10 text-[color:var(--color-text-mute)] hover:text-[color:var(--color-danger)] flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </li>
      {/each}
    </ul>
  </div>

  <div class="mt-6 flex flex-wrap items-center gap-3">
    <button
      onclick={merge}
      disabled={merging || !ready || items.every(it => !it.pageCount)}
      class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {#if merging}
        <span class="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
        Merging… {progress}%
      {:else}
        Merge PDFs
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
  <div class="mt-4 p-3 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">
    {error}
  </div>
{/if}
