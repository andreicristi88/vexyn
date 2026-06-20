<script lang="ts">
  import { onMount } from 'svelte';

  type Status = 'idle' | 'loading-model' | 'ready' | 'processing' | 'done' | 'error';

  let lib: any = $state(null);
  let model: any = $state(null);
  let processor: any = $state(null);
  let device: 'webgpu' | 'wasm' = $state('wasm');
  let status: Status = $state('idle');
  let loadProgress = $state(0);
  let loadLabel = $state('');
  let inferProgress = $state(0);
  let errorMsg = $state('');

  let originalUrl = $state('');
  let originalName = $state('image.png');
  let outputUrl = $state('');
  let originalWidth = $state(0);
  let originalHeight = $state(0);

  let bgMode: 'transparent' | 'color' = $state('transparent');
  let bgColor = $state('#ffffff');
  let dragOver = $state(false);
  let fileInput: HTMLInputElement;
  let originalBitmap: ImageBitmap | null = null;
  let maskCache: any = null;

  const MODEL_ID = 'briaai/RMBG-1.4';

  onMount(async () => {
    if (typeof window === 'undefined') return;
    status = 'loading-model';
    try {
      lib = await import('@huggingface/transformers');
      lib.env.allowLocalModels = false;
      lib.env.useBrowserCache = true;

      // Detect WebGPU
      // @ts-ignore
      device = (navigator.gpu && (await tryWebGPU())) ? 'webgpu' : 'wasm';

      const progress_callback = (p: any) => {
        if (p.status === 'progress' && p.file) {
          loadProgress = Math.round(p.progress ?? 0);
          loadLabel = `${p.file} — ${loadProgress}%`;
        } else if (p.status === 'done' && p.file) {
          loadLabel = `${p.file} — done`;
        } else if (p.status === 'ready') {
          loadLabel = 'Ready';
        }
      };

      model = await lib.AutoModel.from_pretrained(MODEL_ID, {
        config: { model_type: 'custom' },
        dtype: device === 'webgpu' ? 'fp32' : 'fp32',
        device,
        progress_callback,
      });

      processor = await lib.AutoProcessor.from_pretrained(MODEL_ID, {
        config: {
          do_normalize: true,
          do_pad: false,
          do_rescale: true,
          do_resize: true,
          image_mean: [0.5, 0.5, 0.5],
          image_std: [1, 1, 1],
          resample: 2,
          rescale_factor: 0.00392156862745098,
          size: { width: 1024, height: 1024 },
        },
      });

      status = 'ready';
    } catch (e: any) {
      console.error('[BgRemover] init failed', e);
      errorMsg = e?.message || 'Failed to load the model.';
      status = 'error';
    }
  });

  async function tryWebGPU(): Promise<boolean> {
    try {
      // @ts-ignore
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  async function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files && t.files[0]) await handleFile(t.files[0]);
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
      errorMsg = 'Please drop an image (PNG, JPG, WebP).';
      return;
    }
    errorMsg = '';
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = '';
    maskCache = null;
    originalName = file.name.replace(/\.[^.]+$/, '') + '-nobg.png';
    originalUrl = URL.createObjectURL(file);

    originalBitmap = await createImageBitmap(file);
    originalWidth = originalBitmap.width;
    originalHeight = originalBitmap.height;

    if (status === 'ready' || status === 'done') {
      await process();
    }
  }

  async function process() {
    if (!model || !processor || !originalBitmap || !originalUrl) return;
    status = 'processing';
    inferProgress = 10;
    errorMsg = '';

    try {
      const image = await lib.RawImage.fromURL(originalUrl);
      inferProgress = 25;
      const { pixel_values } = await processor(image);
      inferProgress = 45;
      const { output } = await model({ input: pixel_values });
      inferProgress = 75;

      const mask = await lib.RawImage.fromTensor(
        output[0].mul(255).to('uint8'),
      ).resize(image.width, image.height);
      maskCache = { mask, w: image.width, h: image.height };
      inferProgress = 90;
      renderOutput();
      inferProgress = 100;
      status = 'done';
    } catch (e: any) {
      console.error('[BgRemover] inference failed', e);
      errorMsg = e?.message || 'Inference failed.';
      status = 'error';
    }
  }

  function renderOutput() {
    if (!maskCache || !originalBitmap) return;
    const { mask, w, h } = maskCache;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    if (bgMode === 'color') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.drawImage(originalBitmap, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h);
    const data = pixels.data;

    if (bgMode === 'transparent') {
      for (let i = 0; i < mask.data.length; i++) {
        data[4 * i + 3] = mask.data[i];
      }
    } else {
      // composite original over background using mask as alpha
      const bg = hexToRgb(bgColor);
      for (let i = 0; i < mask.data.length; i++) {
        const a = mask.data[i] / 255;
        data[4 * i + 0] = data[4 * i + 0] * a + bg.r * (1 - a);
        data[4 * i + 1] = data[4 * i + 1] * a + bg.g * (1 - a);
        data[4 * i + 2] = data[4 * i + 2] * a + bg.b * (1 - a);
        data[4 * i + 3] = 255;
      }
    }

    ctx.putImageData(pixels, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = URL.createObjectURL(blob);
    }, 'image/png');
  }

  function hexToRgb(h: string) {
    const x = h.replace('#', '');
    return {
      r: parseInt(x.slice(0, 2), 16),
      g: parseInt(x.slice(2, 4), 16),
      b: parseInt(x.slice(4, 6), 16),
    };
  }

  $effect(() => {
    void bgMode; void bgColor;
    if (maskCache && originalBitmap) renderOutput();
  });
</script>

<!-- Status bar -->
<div class="mb-6 flex items-center justify-between gap-3 p-3 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
  <div class="flex items-center gap-3 text-sm">
    <span class:list={[
      'inline-block w-2 h-2 rounded-full',
      status === 'ready' || status === 'done' ? 'bg-[color:var(--color-success)]' :
      status === 'error' ? 'bg-[color:var(--color-danger)]' :
      'bg-[color:var(--color-warning)] animate-pulse'
    ]}></span>
    {#if status === 'idle'}
      <span class="text-[color:var(--color-text-mute)]">Initializing…</span>
    {:else if status === 'loading-model'}
      <span class="text-[color:var(--color-text-mute)]">Loading model… <span class="font-mono text-xs">{loadLabel}</span></span>
    {:else if status === 'ready'}
      <span class="text-[color:var(--color-text)]">Ready</span>
    {:else if status === 'processing'}
      <span class="text-[color:var(--color-text-mute)]">Removing background… {inferProgress}%</span>
    {:else if status === 'done'}
      <span class="text-[color:var(--color-text)]">Done</span>
    {:else if status === 'error'}
      <span class="text-[color:var(--color-danger)]">Error: {errorMsg}</span>
    {/if}
  </div>
  <div class="text-xs text-[color:var(--color-text-dim)] font-mono uppercase tracking-wider">
    {device}
    {#if device === 'wasm'}
      <span class="ml-1 text-[color:var(--color-warning)]">(no WebGPU — slower)</span>
    {/if}
  </div>
</div>

<!-- Drop zone -->
<button
  type="button"
  onclick={() => fileInput?.click()}
  ondrop={onDrop}
  ondragover={onDragOver}
  ondragleave={() => dragOver = false}
  disabled={status === 'loading-model'}
  class:list={[
    'w-full p-10 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3',
    status === 'loading-model' ? 'cursor-wait opacity-60' : 'cursor-pointer',
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
      {dragOver ? 'Drop your image' : 'Drop an image here or click to browse'}
    </p>
    <p class="text-xs text-[color:var(--color-text-mute)] mt-1">
      JPG, PNG, WebP. Runs on your device — image never uploaded.
    </p>
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept="image/*"
    onchange={onPick}
    class="hidden"
  />
</button>

{#if status === 'loading-model'}
  <div class="mt-4 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
    <div class="flex justify-between text-xs text-[color:var(--color-text-mute)] mb-1.5">
      <span>First-time model download (~85 MB, then cached)</span>
      <span class="font-mono">{loadProgress}%</span>
    </div>
    <div class="h-1.5 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
      <div class="h-full bg-[color:var(--color-brand-500)] transition-all" style:width={`${loadProgress}%`}></div>
    </div>
  </div>
{/if}

{#if originalUrl}
  <!-- Preview side-by-side -->
  <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <h3 class="text-xs font-medium text-[color:var(--color-text-mute)] mb-2 uppercase tracking-wider">Original</h3>
      <div class="rounded-lg overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] aspect-video flex items-center justify-center">
        <img src={originalUrl} alt="Original" class="max-w-full max-h-full object-contain" />
      </div>
      {#if originalWidth}
        <p class="text-xs text-[color:var(--color-text-dim)] mt-1">{originalWidth} × {originalHeight}px</p>
      {/if}
    </div>
    <div>
      <h3 class="text-xs font-medium text-[color:var(--color-text-mute)] mb-2 uppercase tracking-wider">Background removed</h3>
      <div
        class="rounded-lg overflow-hidden border border-[color:var(--color-border)] aspect-video flex items-center justify-center relative"
        style:background={bgMode === 'transparent'
          ? 'repeating-conic-gradient(#2a2a36 0% 25%, #1c1c26 0% 50%) 50% / 24px 24px'
          : 'var(--color-surface)'}
      >
        {#if outputUrl}
          <img src={outputUrl} alt="Background removed" class="max-w-full max-h-full object-contain" />
        {:else if status === 'processing'}
          <div class="flex flex-col items-center gap-2">
            <div class="w-6 h-6 rounded-full border-2 border-[color:var(--color-border-strong)] border-t-[color:var(--color-brand-500)] animate-spin"></div>
            <p class="text-xs text-[color:var(--color-text-dim)] font-mono">{inferProgress}%</p>
          </div>
        {:else}
          <p class="text-xs text-[color:var(--color-text-dim)]">Waiting…</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Background options + actions -->
  <div class="mt-4 flex flex-wrap items-center gap-3 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium text-[color:var(--color-text-mute)] uppercase tracking-wider">Background</span>
      <div class="flex p-0.5 rounded-md bg-[color:var(--color-bg)] border border-[color:var(--color-border)]">
        <button
          onclick={() => bgMode = 'transparent'}
          class:list={[
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            bgMode === 'transparent' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
          ]}
        >
          Transparent
        </button>
        <button
          onclick={() => bgMode = 'color'}
          class:list={[
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            bgMode === 'color' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
          ]}
        >
          Color
        </button>
      </div>
      {#if bgMode === 'color'}
        <input type="color" bind:value={bgColor} class="w-8 h-8 rounded border border-[color:var(--color-border)] bg-transparent cursor-pointer" aria-label="Background color" />
      {/if}
    </div>

    <div class="flex items-center gap-2 ml-auto">
      <button
        onclick={process}
        disabled={status === 'processing' || status === 'loading-model' || !originalUrl}
        class="px-4 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Re-process
      </button>
      {#if outputUrl}
        <a
          href={outputUrl}
          download={originalName}
          class="px-4 py-2 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download PNG
        </a>
      {/if}
    </div>
  </div>
{/if}
