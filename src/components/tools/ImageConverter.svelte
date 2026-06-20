<script lang="ts">
  import { onMount } from 'svelte';

  type Fmt = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
  type Item = {
    id: string;
    file: File;
    originalSize: number;
    converted?: Blob;
    convertedUrl?: string;
    convertedSize?: number;
    processing: boolean;
    error?: string;
  };

  let items = $state<Item[]>([]);
  let target: Fmt = $state('image/webp');
  let quality = $state(0.9);
  let error = $state('');
  let dragOver = $state(false);
  let fileInput: HTMLInputElement;

  function uid() { return Math.random().toString(36).slice(2, 10); }

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

  onMount(() => {
    window.addEventListener('paste', onClipboardPaste);
    return () => window.removeEventListener('paste', onClipboardPaste);
  });

  async function addFiles(fl: FileList | File[]) {
    error = '';
    const arr = Array.from(fl).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) {
      error = 'Drop image files.';
      return;
    }
    const newIds = arr.map(() => uid());
    const newItems: Item[] = arr.map((file, i) => ({
      id: newIds[i],
      file,
      originalSize: file.size,
      processing: true,
    }));
    items = [...items, ...newItems];
    for (const id of newIds) await convert(id);
  }

  async function convert(id: string) {
    const idx0 = items.findIndex((x) => x.id === id);
    if (idx0 === -1) return;
    items[idx0].processing = true;
    items[idx0].error = undefined;
    if (items[idx0].convertedUrl) {
      URL.revokeObjectURL(items[idx0].convertedUrl!);
      items[idx0].convertedUrl = undefined;
    }

    const file = items[idx0].file;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const out = await new Promise<Blob>((res, rej) => {
        canvas.toBlob(
          (b) => b ? res(b) : rej(new Error('Conversion failed (browser may not support target format).')),
          target,
          target === 'image/png' ? undefined : quality,
        );
      });
      const url = URL.createObjectURL(out);
      const idx = items.findIndex((x) => x.id === id);
      if (idx === -1) return;
      items[idx].converted = out;
      items[idx].convertedSize = out.size;
      items[idx].convertedUrl = url;
    } catch (e: any) {
      const idx = items.findIndex((x) => x.id === id);
      if (idx !== -1) {
        items[idx].error = e?.message || 'Could not convert.';
        console.error('[ImageConverter] convert failed', file.name, e);
      }
    } finally {
      const idx = items.findIndex((x) => x.id === id);
      if (idx !== -1) items[idx].processing = false;
    }
  }

  function reconvertAll() {
    for (const it of items) convert(it.id);
  }

  function remove(id: string) {
    const it = items.find((x) => x.id === id);
    if (it?.convertedUrl) URL.revokeObjectURL(it.convertedUrl);
    items = items.filter((x) => x.id !== id);
  }
  function clearAll() {
    for (const it of items) if (it.convertedUrl) URL.revokeObjectURL(it.convertedUrl);
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

  function extFor(t: Fmt) {
    return t === 'image/jpeg' ? 'jpg'
      : t === 'image/png' ? 'png'
      : t === 'image/webp' ? 'webp'
      : 'avif';
  }
  function targetName(it: Item) {
    const dot = it.file.name.lastIndexOf('.');
    const base = dot > 0 ? it.file.name.slice(0, dot) : it.file.name;
    return `${base}.${extFor(target)}`;
  }
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
  <div>
    <label for="ic-t" class="block text-xs font-medium text-[color:var(--color-text-mute)] mb-1 uppercase tracking-wider">Target format</label>
    <select
      id="ic-t"
      bind:value={target}
      class="w-full p-2 rounded bg-[color:var(--color-bg)] border border-[color:var(--color-border)] text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-brand-500)] focus:outline-none"
    >
      <option value="image/webp">WebP (best size/quality ratio)</option>
      <option value="image/avif">AVIF (smallest, slower encode)</option>
      <option value="image/jpeg">JPEG (universal)</option>
      <option value="image/png">PNG (lossless, no transparency loss)</option>
    </select>
  </div>
  <div>
    <label for="ic-q" class="block text-xs font-medium text-[color:var(--color-text-mute)] mb-1 uppercase tracking-wider">Quality: {Math.round(quality * 100)}%</label>
    <input
      id="ic-q"
      type="range"
      min="0.1"
      max="1"
      step="0.05"
      bind:value={quality}
      disabled={target === 'image/png'}
      class="w-full disabled:opacity-40"
    />
  </div>
</div>

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
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
  <div class="text-center">
    <p class="font-medium text-[color:var(--color-text)]">
      {dragOver ? 'Drop your images' : 'Drop images to convert'}
    </p>
    <p class="text-xs text-[color:var(--color-text-mute)] mt-1">Multiple files or paste from clipboard (Ctrl/Cmd + V). Conversion happens in your browser.</p>
  </div>
  <input bind:this={fileInput} type="file" accept="image/*" multiple onchange={onPick} class="hidden" />
</button>

{#if items.length > 0}
  <div class="mt-6 flex flex-wrap items-center gap-3">
    <span class="text-sm text-[color:var(--color-text-mute)]">{items.length} file{items.length === 1 ? '' : 's'}</span>
    <button onclick={reconvertAll} class="text-xs px-3 py-1.5 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] ml-auto">
      Re-convert all
    </button>
    <button onclick={clearAll} class="text-xs px-3 py-1.5 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]">
      Clear all
    </button>
  </div>

  <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {#each items as it (it.id)}
      <div class="rounded-lg overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] flex flex-col">
        <div class="aspect-video bg-[color:var(--color-bg)] flex items-center justify-center overflow-hidden">
          {#if it.convertedUrl}
            <img src={it.convertedUrl} alt={it.file.name} class="max-w-full max-h-full object-contain" />
          {:else if it.processing}
            <div class="w-6 h-6 rounded-full border-2 border-[color:var(--color-border-strong)] border-t-[color:var(--color-brand-500)] animate-spin"></div>
          {/if}
        </div>
        <div class="p-3 flex-1 flex flex-col gap-1.5">
          <p class="text-xs font-medium truncate" title={it.file.name}>{it.file.name}</p>
          <p class="text-xs text-[color:var(--color-text-mute)] font-mono">
            {fmtSize(it.originalSize)}{#if it.convertedSize} → <span class="text-[color:var(--color-text)]">{fmtSize(it.convertedSize)}</span>{/if}
          </p>
          {#if it.error}
            <p class="text-xs text-[color:var(--color-danger)]">{it.error}</p>
          {/if}
          <div class="flex gap-2 mt-auto pt-1">
            {#if it.convertedUrl}
              <a
                href={it.convertedUrl}
                download={targetName(it)}
                class="flex-1 text-center px-2 py-1.5 text-xs rounded bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors"
              >
                Download .{extFor(target)}
              </a>
            {/if}
            <button
              onclick={() => remove(it.id)}
              aria-label="Remove"
              class="px-2 py-1.5 text-xs rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-danger)] hover:border-[color:var(--color-danger)]/50 transition-colors"
            >×</button>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

{#if error}
  <div class="mt-4 p-3 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
{/if}
