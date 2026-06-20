<script lang="ts">
  import { onMount } from 'svelte';
  import ErrorDisplay from '../ui/ErrorDisplay.svelte';
  import { swipeable } from '../../lib/swipeable';

  type Item = {
    id: string;
    file: File;
    originalSize: number;
    compressed?: Blob;
    compressedSize?: number;
    url?: string;
    width?: number;
    height?: number;
    error?: string;
    processing: boolean;
  };

  let compress: any = $state(null);
  let ready = $state(false);
  let items = $state<Item[]>([]);
  let quality = $state(0.8);
  let maxWidth = $state(2048);
  let format = $state<'auto' | 'image/jpeg' | 'image/png' | 'image/webp'>('auto');
  let error = $state('');
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  function onClipboardPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) { e.preventDefault(); addFiles(files); }
  }

  onMount(async () => {
    window.addEventListener('paste', onClipboardPaste);
    try {
      const mod = await import('browser-image-compression');
      compress = mod.default ?? mod;
      ready = true;
    } catch (e: any) {
      error = `Could not load compressor: ${e?.message ?? e}`;
      console.error('[ImageCompressor] import failed', e);
    }
    return () => window.removeEventListener('paste', onClipboardPaste);
  });

  const totalOriginal = $derived(items.reduce((s, it) => s + it.originalSize, 0));
  const totalCompressed = $derived(items.reduce((s, it) => s + (it.compressedSize ?? 0), 0));
  const totalSaved = $derived(totalOriginal - totalCompressed);
  const savedPct = $derived(totalOriginal > 0 && totalCompressed > 0 ? Math.round((totalSaved / totalOriginal) * 100) : 0);

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  async function addFiles(fileList: FileList | File[]) {
    error = '';
    const arr = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) {
      error = 'Drop image files (JPG, PNG, WebP).';
      return;
    }
    const newItems: Item[] = arr.map(file => ({
      id: uid(),
      file,
      originalSize: file.size,
      processing: true,
    }));
    items = [...items, ...newItems];
    for (const it of newItems) {
      processItem(it.id);
    }
  }

  async function processItem(id: string) {
    if (!compress) return;
    const it = items.find(x => x.id === id);
    if (!it) return;

    it.processing = true;
    it.error = undefined;
    if (it.url) {
      URL.revokeObjectURL(it.url);
      it.url = undefined;
    }
    items = [...items];

    try {
      const opts: any = {
        maxSizeMB: 100,
        maxWidthOrHeight: maxWidth,
        useWebWorker: true,
        initialQuality: quality,
      };
      if (format !== 'auto') opts.fileType = format;

      const out: Blob = await compress(it.file, opts);
      const url = URL.createObjectURL(out);

      // Get dimensions
      const img = new Image();
      img.src = url;
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
      });

      it.compressed = out;
      it.compressedSize = out.size;
      it.url = url;
      it.width = img.naturalWidth || undefined;
      it.height = img.naturalHeight || undefined;
    } catch (e: any) {
      it.error = e?.message ?? 'Compression failed.';
      console.error('[ImageCompressor] failed', it.file.name, e);
    } finally {
      it.processing = false;
      items = [...items];
    }
  }

  function recompressAll() {
    for (const it of items) {
      processItem(it.id);
    }
  }

  function remove(id: string) {
    const it = items.find(x => x.id === id);
    if (it?.url) URL.revokeObjectURL(it.url);
    items = items.filter(x => x.id !== id);
  }

  function clearAll() {
    for (const it of items) {
      if (it.url) URL.revokeObjectURL(it.url);
    }
    items = [];
    error = '';
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

  function fmtSize(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  function suggestedName(it: Item) {
    const dot = it.file.name.lastIndexOf('.');
    const base = dot > 0 ? it.file.name.slice(0, dot) : it.file.name;
    const ext = format === 'image/webp' ? 'webp'
              : format === 'image/png' ? 'png'
              : format === 'image/jpeg' ? 'jpg'
              : (dot > 0 ? it.file.name.slice(dot + 1) : 'bin');
    return `${base}-compressed.${ext}`;
  }
</script>

<!-- Controls -->
<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
  <div>
    <label for="ic-q" class="block text-xs font-medium text-[color:var(--color-text-mute)] mb-1">Quality: {Math.round(quality * 100)}%</label>
    <input
      id="ic-q"
      type="range"
      min="0.1"
      max="1"
      step="0.05"
      bind:value={quality}
      class="w-full"
    />
  </div>
  <div>
    <label for="ic-w" class="block text-xs font-medium text-[color:var(--color-text-mute)] mb-1">Max dimension: {maxWidth}px</label>
    <input
      id="ic-w"
      type="range"
      min="256"
      max="4096"
      step="128"
      bind:value={maxWidth}
      class="w-full"
    />
  </div>
  <div>
    <label for="ic-f" class="block text-xs font-medium text-[color:var(--color-text-mute)] mb-1">Output format</label>
    <select
      id="ic-f"
      bind:value={format}
      class="w-full p-2 rounded bg-[color:var(--color-bg)] border border-[color:var(--color-border)] text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-brand-500)] focus:outline-none"
    >
      <option value="auto">Auto (keep original)</option>
      <option value="image/webp">WebP (best compression)</option>
      <option value="image/jpeg">JPEG</option>
      <option value="image/png">PNG</option>
    </select>
  </div>
</div>

<!-- Drop zone -->
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
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
  <div class="text-center">
    <p class="font-medium text-[color:var(--color-text)]">
      {dragOver ? 'Drop your images' : 'Drop JPG / PNG / WebP / HEIC here or click'}
    </p>
    <p class="text-xs text-[color:var(--color-text-mute)] mt-1">
      Multiple files or paste from clipboard (Ctrl/Cmd + V). Everything runs in your browser.
    </p>
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept="image/*"
    multiple
    onchange={onPick}
    class="hidden"
  />
</button>

{#if !ready && !error}
  <p class="mt-4 text-sm text-[color:var(--color-text-dim)] text-center">Loading compression engine…</p>
{/if}

{#if items.length > 0}
  <!-- Totals -->
  <div class="mt-6 flex flex-wrap items-center gap-3 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
    <div class="text-sm">
      <span class="text-[color:var(--color-text-mute)]">Original:</span>
      <span class="font-mono ml-1">{fmtSize(totalOriginal)}</span>
    </div>
    <div class="text-sm">
      <span class="text-[color:var(--color-text-mute)]">Compressed:</span>
      <span class="font-mono ml-1">{fmtSize(totalCompressed)}</span>
    </div>
    {#if totalSaved > 0}
      <div class="text-sm ml-auto px-3 py-1 rounded-md bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 text-[color:var(--color-success)] font-medium">
        Saved {fmtSize(totalSaved)} ({savedPct}%)
      </div>
    {/if}
    <button onclick={recompressAll} class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]">
      Recompress all
    </button>
    <button onclick={clearAll} class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]">
      Clear all
    </button>
  </div>

  <!-- Grid -->
  <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {#each items as it (it.id)}
      <div
        use:swipeable={{ onSwipe: () => remove(it.id) }}
        class="rounded-lg overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] flex flex-col touch-pan-y"
      >
        <div class="aspect-video bg-[color:var(--color-bg)] flex items-center justify-center overflow-hidden relative">
          {#if it.url}
            <img src={it.url} alt={it.file.name} class="max-w-full max-h-full object-contain" />
          {:else if it.processing}
            <div class="w-6 h-6 rounded-full border-2 border-[color:var(--color-border-strong)] border-t-[color:var(--color-brand-500)] animate-spin"></div>
          {/if}
        </div>
        <div class="p-3 flex-1 flex flex-col gap-1.5">
          <p class="text-xs font-medium truncate" title={it.file.name}>{it.file.name}</p>
          <div class="flex items-center justify-between text-xs">
            <span class="text-[color:var(--color-text-mute)] font-mono">
              {fmtSize(it.originalSize)}
              {#if it.compressedSize}
                → <span class="text-[color:var(--color-text)]">{fmtSize(it.compressedSize)}</span>
              {/if}
            </span>
            {#if it.compressedSize && it.compressedSize < it.originalSize}
              <span class="text-[color:var(--color-success)] font-medium">
                −{Math.round((1 - it.compressedSize / it.originalSize) * 100)}%
              </span>
            {/if}
          </div>
          {#if it.width && it.height}
            <p class="text-[10px] text-[color:var(--color-text-dim)]">{it.width} × {it.height}px</p>
          {/if}
          {#if it.error}
            <p class="text-xs text-[color:var(--color-danger)]">{it.error}</p>
          {/if}
          <div class="flex gap-2 mt-1">
            {#if it.url}
              <a
                href={it.url}
                download={suggestedName(it)}
                class="flex-1 text-center px-2 py-1.5 text-xs rounded bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors"
              >
                Download
              </a>
            {/if}
            <button
              onclick={() => remove(it.id)}
              aria-label="Remove"
              class="px-2 py-1.5 text-xs rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-danger)] hover:border-[color:var(--color-danger)]/50 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

{#if error}
  <ErrorDisplay
    message={error}
    hint="Drop standard image files (JPG, PNG, WebP, HEIC). Very large batches may run out of memory — try fewer at a time."
    onRetry={() => { error = ''; }}
    issueTitle="Image Compressor failed"
  />
{/if}
