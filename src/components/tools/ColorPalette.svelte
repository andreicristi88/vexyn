<script lang="ts">
  import { onMount } from 'svelte';

  type Swatch = { hex: string; rgb: [number, number, number]; count: number };

  let imageUrl = $state('');
  let imageName = $state('');
  let palette = $state<Swatch[]>([]);
  let count = $state(8);
  let processing = $state(false);
  let error = $state('');
  let dragOver = $state(false);
  let copied = $state('');
  let fileInput: HTMLInputElement;

  function onClipboardPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) { e.preventDefault(); handleFile(f); return; }
      }
    }
  }

  onMount(() => {
    window.addEventListener('paste', onClipboardPaste);
    return () => window.removeEventListener('paste', onClipboardPaste);
  });

  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.[0]) handleFile(t.files[0]);
    t.value = '';
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      error = 'Drop an image (JPG, PNG, WebP).';
      return;
    }
    error = '';
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);
    imageName = file.name;
    palette = [];
    await extract(file);
  }

  async function extract(file?: File) {
    if (!imageUrl) return;
    processing = true;
    try {
      const bitmap = await createImageBitmap(file ?? await fetch(imageUrl).then(r => r.blob()));
      // Downscale for speed
      const maxDim = 200;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;

      // Quantize to 4-bit per channel buckets (16^3 = 4096 buckets), then merge
      const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 128) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const cur = buckets.get(key);
        if (cur) {
          cur.r += r; cur.g += g; cur.b += b; cur.n++;
        } else {
          buckets.set(key, { r, g, b, n: 1 });
        }
      }

      const sorted = [...buckets.values()]
        .map((c) => ({
          r: Math.round(c.r / c.n),
          g: Math.round(c.g / c.n),
          b: Math.round(c.b / c.n),
          n: c.n,
        }))
        .sort((a, b) => b.n - a.n);

      // De-duplicate near-identical colors (delta < 40 in any axis)
      const out: Swatch[] = [];
      for (const c of sorted) {
        const tooClose = out.some(
          (s) => Math.abs(s.rgb[0] - c.r) < 24 && Math.abs(s.rgb[1] - c.g) < 24 && Math.abs(s.rgb[2] - c.b) < 24,
        );
        if (tooClose) continue;
        out.push({ hex: rgbToHex(c.r, c.g, c.b), rgb: [c.r, c.g, c.b], count: c.n });
        if (out.length >= count) break;
      }
      palette = out;
    } catch (e: any) {
      error = e?.message || 'Could not extract palette.';
      console.error('[ColorPalette] extract failed', e);
    } finally {
      processing = false;
    }
  }

  function rgbToHex(r: number, g: number, b: number) {
    const h = (n: number) => n.toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
  }
  function rgbStr(rgb: [number, number, number]) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }
  function hslStr(rgb: [number, number, number]) {
    const [r, g, b] = rgb.map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    copied = label;
    setTimeout(() => { if (copied === label) copied = ''; }, 1200);
  }

  function copyAll(format: 'hex' | 'rgb' | 'hsl' | 'css') {
    let text = '';
    if (format === 'hex') text = palette.map((s) => s.hex).join('\n');
    else if (format === 'rgb') text = palette.map((s) => rgbStr(s.rgb)).join('\n');
    else if (format === 'hsl') text = palette.map((s) => hslStr(s.rgb)).join('\n');
    else text = palette.map((s, i) => `--color-${i + 1}: ${s.hex};`).join('\n');
    copy(text, `all-${format}`);
  }

  $effect(() => {
    void count;
    if (imageUrl) extract();
  });

  function textColorOn(rgb: [number, number, number]) {
    const [r, g, b] = rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#0a0a0f' : '#ffffff';
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
    <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
  </svg>
  <div class="text-center">
    <p class="font-medium text-[color:var(--color-text)]">
      {dragOver ? 'Drop your image' : imageUrl ? 'Drop another to replace' : 'Drop an image to extract its palette'}
    </p>
    <p class="text-xs text-[color:var(--color-text-mute)] mt-1">JPG, PNG, WebP. Or paste from clipboard (Ctrl/Cmd + V). Pure pixel sampling — never uploaded.</p>
  </div>
  <input bind:this={fileInput} type="file" accept="image/*" onchange={onPick} class="hidden" />
</button>

{#if imageUrl}
  <div class="mt-6 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
    <div>
      <h3 class="text-xs font-medium text-[color:var(--color-text-mute)] mb-2 uppercase tracking-wider">Source</h3>
      <div class="rounded-lg overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] aspect-video flex items-center justify-center">
        <img src={imageUrl} alt={imageName} class="max-w-full max-h-full object-contain" />
      </div>
      <p class="text-xs text-[color:var(--color-text-dim)] mt-1 truncate" title={imageName}>{imageName}</p>
    </div>
    <div>
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-medium text-[color:var(--color-text-mute)] uppercase tracking-wider">Palette</h3>
        <label class="flex items-center gap-2 text-xs text-[color:var(--color-text-mute)]">
          Colors: {count}
          <input type="range" min="3" max="16" bind:value={count} class="w-24" />
        </label>
      </div>
      <div class="rounded-lg overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] aspect-video">
        {#if processing && palette.length === 0}
          <div class="flex h-full items-center justify-center">
            <div class="w-6 h-6 rounded-full border-2 border-[color:var(--color-border-strong)] border-t-[color:var(--color-brand-500)] animate-spin"></div>
          </div>
        {:else if palette.length > 0}
          <div class="flex h-full">
            {#each palette as s (s.hex)}
              <button
                onclick={() => copy(s.hex, s.hex)}
                class="flex-1 group relative flex flex-col items-center justify-center transition-transform hover:flex-[2]"
                style:background={s.hex}
                style:color={textColorOn(s.rgb)}
                aria-label={`Copy ${s.hex}`}
                title="Click to copy"
              >
                <span class="text-xs font-mono opacity-80 group-hover:opacity-100 transition-opacity">
                  {copied === s.hex ? '✓ Copied' : s.hex}
                </span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if palette.length > 0}
    <div class="mt-4 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium text-[color:var(--color-text-mute)] uppercase tracking-wider">Copy all as</span>
        {#each ['hex','rgb','hsl','css'] as fmt}
          <button
            onclick={() => copyAll(fmt as any)}
            class="text-xs px-3 py-1.5 rounded bg-[color:var(--color-bg)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] font-medium uppercase tracking-wider"
          >
            {copied === `all-${fmt}` ? '✓ ' : ''}{fmt}
          </button>
        {/each}
      </div>

      <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-xs">
        {#each palette as s, i (s.hex)}
          <div class="flex items-center gap-2 p-2 rounded bg-[color:var(--color-bg)] border border-[color:var(--color-border)]">
            <div class="w-6 h-6 rounded flex-shrink-0" style:background={s.hex}></div>
            <div class="flex-1 min-w-0">
              <p class="truncate">{s.hex}</p>
              <p class="text-[color:var(--color-text-dim)] truncate text-[10px]">{rgbStr(s.rgb)}</p>
            </div>
            <button
              onclick={() => copy(s.hex, `${i}-hex`)}
              class="text-[10px] px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]"
            >
              {copied === `${i}-hex` ? '✓' : 'copy'}
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/if}

{#if error}
  <div class="mt-4 p-3 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
{/if}
