<script lang="ts">
  import { onMount } from 'svelte';
  import ErrorDisplay from '../ui/ErrorDisplay.svelte';
  import { swipeable } from '../../lib/swipeable';

  type Item = {
    id: string;
    file: File;
    originalSize: number;
    metadata: Record<string, any> | null;
    metadataCount: number;
    cleanedBlob?: Blob;
    cleanedUrl?: string;
    cleanedSize?: number;
    processing: boolean;
    error?: string;
  };

  let exifr: any = $state(null);
  let ready = $state(false);
  let items = $state<Item[]>([]);
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
      exifr = await import('exifr');
      ready = true;
    } catch (e: any) {
      error = `Could not load EXIF reader: ${e?.message ?? e}`;
      console.error('[ExifRemover] init failed', e);
    }
    return () => window.removeEventListener('paste', onClipboardPaste);
  });

  function uid() { return Math.random().toString(36).slice(2, 10); }

  async function addFiles(fl: FileList | File[]) {
    error = '';
    const arr = Array.from(fl).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) {
      error = 'Drop image files (JPG, PNG, WebP, HEIC).';
      return;
    }
    const newIds = arr.map(() => uid());
    const newItems: Item[] = arr.map((file, i) => ({
      id: newIds[i],
      file,
      originalSize: file.size,
      metadata: null,
      metadataCount: 0,
      processing: true,
    }));
    items = [...items, ...newItems];

    while (!exifr && !error) await new Promise((r) => setTimeout(r, 50));
    if (!exifr) return;

    for (const id of newIds) {
      const idx0 = items.findIndex((x) => x.id === id);
      if (idx0 === -1) continue;
      const file = items[idx0].file;
      try {
        let meta: any = null;
        try {
          meta = await exifr.parse(file, {
            tiff: true, exif: true, gps: true, iptc: true, xmp: true, icc: false,
          });
        } catch {
          meta = null;
        }
        const cleaned = await stripMetadata(file);
        const idx = items.findIndex((x) => x.id === id);
        if (idx === -1) continue;
        items[idx].metadata = meta;
        items[idx].metadataCount = meta ? Object.keys(meta).length : 0;
        items[idx].cleanedBlob = cleaned;
        items[idx].cleanedSize = cleaned.size;
        if (items[idx].cleanedUrl) URL.revokeObjectURL(items[idx].cleanedUrl!);
        items[idx].cleanedUrl = URL.createObjectURL(cleaned);
      } catch (e: any) {
        const idx = items.findIndex((x) => x.id === id);
        if (idx !== -1) {
          items[idx].error = e?.message || 'Could not process this image.';
          console.error('[ExifRemover] process failed', file.name, e);
        }
      } finally {
        const idx = items.findIndex((x) => x.id === id);
        if (idx !== -1) items[idx].processing = false;
      }
    }
  }

  async function stripMetadata(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = outType === 'image/jpeg' ? 0.92 : undefined;
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        outType,
        quality,
      );
    });
  }

  function remove(id: string) {
    const it = items.find((x) => x.id === id);
    if (it?.cleanedUrl) URL.revokeObjectURL(it.cleanedUrl);
    items = items.filter((x) => x.id !== id);
  }
  function clearAll() {
    for (const it of items) if (it.cleanedUrl) URL.revokeObjectURL(it.cleanedUrl);
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

  function cleanedName(it: Item) {
    const dot = it.file.name.lastIndexOf('.');
    const base = dot > 0 ? it.file.name.slice(0, dot) : it.file.name;
    const ext = (it.cleanedBlob?.type === 'image/png') ? 'png' : 'jpg';
    return `${base}-clean.${ext}`;
  }

  function hasGPS(meta: Record<string, any> | null) {
    if (!meta) return false;
    return !!(meta.latitude || meta.longitude || meta.GPSLatitude || meta.GPSLongitude);
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
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
  <div class="text-center">
    <p class="font-medium text-[color:var(--color-text)]">
      {dragOver ? 'Drop your images' : 'Drop images to strip metadata'}
    </p>
    <p class="text-xs text-[color:var(--color-text-mute)] mt-1">JPG, PNG, WebP, HEIC. Or paste from clipboard (Ctrl/Cmd + V). GPS, camera, timestamps removed locally.</p>
  </div>
  <input bind:this={fileInput} type="file" accept="image/*" multiple onchange={onPick} class="hidden" />
</button>

{#if !ready && !error}
  <p class="mt-4 text-sm text-[color:var(--color-text-dim)] text-center">Loading EXIF reader…</p>
{/if}

{#if items.length > 0}
  <div class="mt-6 flex items-center justify-between mb-3">
    <h2 class="text-sm font-semibold text-[color:var(--color-text-mute)]">{items.length} image{items.length === 1 ? '' : 's'}</h2>
    <button onclick={clearAll} class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]">Clear all</button>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {#each items as it (it.id)}
      <div
        use:swipeable={{ onSwipe: () => remove(it.id) }}
        class="rounded-lg overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] flex flex-col touch-pan-y"
      >
        <div class="flex">
          <div class="w-24 h-24 bg-[color:var(--color-bg)] flex-shrink-0 flex items-center justify-center overflow-hidden">
            {#if it.cleanedUrl}
              <img src={it.cleanedUrl} alt={it.file.name} class="max-w-full max-h-full object-cover" />
            {:else}
              <div class="w-5 h-5 rounded-full border-2 border-[color:var(--color-border-strong)] border-t-[color:var(--color-brand-500)] animate-spin"></div>
            {/if}
          </div>
          <div class="flex-1 p-3 min-w-0 flex flex-col gap-1.5">
            <p class="text-xs font-medium truncate" title={it.file.name}>{it.file.name}</p>
            <p class="text-xs text-[color:var(--color-text-mute)] font-mono">
              {fmtSize(it.originalSize)}{#if it.cleanedSize} → {fmtSize(it.cleanedSize)}{/if}
            </p>

            <div class="flex flex-wrap gap-1">
              {#if it.metadataCount > 0}
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-warning)]/15 border border-[color:var(--color-warning)]/30 text-[color:var(--color-warning)] font-medium uppercase tracking-wider">
                  Had {it.metadataCount} metadata field{it.metadataCount === 1 ? '' : 's'}
                </span>
              {:else if it.metadata !== null}
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-text-dim)]/15 border border-[color:var(--color-text-dim)]/30 text-[color:var(--color-text-dim)] font-medium uppercase tracking-wider">
                  No metadata
                </span>
              {/if}
              {#if hasGPS(it.metadata)}
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-danger)]/15 border border-[color:var(--color-danger)]/30 text-[color:var(--color-danger)] font-medium uppercase tracking-wider">
                  GPS leaked
                </span>
              {/if}
              {#if it.cleanedUrl}
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-success)]/15 border border-[color:var(--color-success)]/30 text-[color:var(--color-success)] font-medium uppercase tracking-wider">
                  Cleaned
                </span>
              {/if}
            </div>

            {#if it.error}
              <p class="text-xs text-[color:var(--color-danger)]">{it.error}</p>
            {/if}

            <div class="flex gap-2 mt-auto pt-2">
              {#if it.cleanedUrl}
                <a
                  href={it.cleanedUrl}
                  download={cleanedName(it)}
                  class="flex-1 text-center px-2 py-1.5 text-xs rounded bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors"
                >
                  Download cleaned
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

        {#if it.metadata && Object.keys(it.metadata).length > 0}
          <details class="border-t border-[color:var(--color-border)]">
            <summary class="px-3 py-2 text-xs font-medium text-[color:var(--color-text-mute)] cursor-pointer hover:text-[color:var(--color-text)]">
              Show original metadata
            </summary>
            <div class="px-3 pb-3 max-h-48 overflow-auto text-[11px] font-mono text-[color:var(--color-text-mute)] space-y-0.5">
              {#each Object.entries(it.metadata).slice(0, 30) as [k, v]}
                <div class="flex gap-2">
                  <span class="text-[color:var(--color-text-dim)] flex-shrink-0">{k}:</span>
                  <span class="break-all">{String(v).slice(0, 80)}</span>
                </div>
              {/each}
              {#if Object.keys(it.metadata).length > 30}
                <p class="text-[color:var(--color-text-dim)] italic">… and {Object.keys(it.metadata).length - 30} more</p>
              {/if}
            </div>
          </details>
        {/if}
      </div>
    {/each}
  </div>
{/if}

{#if error}
  <ErrorDisplay
    message={error}
    hint="HEIC photos may fail outside Safari. Convert to JPG first if needed."
    onRetry={() => { error = ''; }}
    issueTitle="EXIF Remover failed"
  />
{/if}
