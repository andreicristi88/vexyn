<script lang="ts">
  import { onMount } from 'svelte';

  type Status = 'idle' | 'loading-model' | 'ready' | 'processing' | 'done' | 'error';
  type Scale = 2 | 4;

  const MODELS: Record<Scale, { id: string; size: string; label: string }> = {
    2: { id: 'Xenova/swin2SR-classical-sr-x2-64', size: '~50 MB', label: '2× (faster)' },
    4: { id: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr', size: '~55 MB', label: '4× (max detail)' },
  };

  // Safety caps so we don't OOM the GPU on giant photos. Tuned conservatively
  // because Swin2SR peak memory grows roughly with input * output * channels;
  // a 1280px input at 2x easily exceeds the 2 GB cap most WebGPU contexts get.
  const MAX_INPUT_DIM_2X = 768;
  const MAX_INPUT_DIM_4X = 384;

  // Minimum dimensions on the auto-retry chain; anything below this is too
  // small to be worth upscaling.
  const MIN_INPUT_DIM = 192;

  // Swin2SR uses 64x64 attention windows; input must be a multiple of 64
  // on both dimensions, otherwise ONNX Runtime fails inside the encoder.
  const SWIN_WINDOW = 64;

  let lib: any = $state(null);
  let pipeline: any = $state(null);
  let currentScale: Scale = $state(2);
  let pendingScale: Scale = $state(2);
  let device: 'webgpu' | 'wasm' = $state('wasm');
  let status: Status = $state('idle');
  let loadProgress = $state(0);
  let loadLabel = $state('');
  let errorMsg = $state('');

  let originalUrl = $state('');
  let originalName = $state('upscaled.png');
  let originalWidth = $state(0);
  let originalHeight = $state(0);
  let outputUrl = $state('');
  let outputWidth = $state(0);
  let outputHeight = $state(0);
  let downscaled = $state(false);
  let dragOver = $state(false);
  let compareSlider = $state(50);

  let fileInput: HTMLInputElement;
  let originalBitmap: ImageBitmap | null = null;

  onMount(async () => {
    if (typeof window === 'undefined') return;
    try {
      lib = await import('@huggingface/transformers');
      lib.env.allowLocalModels = false;
      lib.env.useBrowserCache = true;
      device = (navigator as any).gpu && (await tryWebGPU()) ? 'webgpu' : 'wasm';
      status = 'ready';
    } catch (e: any) {
      console.error('[Upscaler] init failed', e);
      errorMsg = e?.message || 'Failed to load the engine.';
      status = 'error';
    }

    // Clipboard paste support
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) { e.preventDefault(); handleFile(f); break; }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  async function tryWebGPU(): Promise<boolean> {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  let activeDevice: 'webgpu' | 'wasm' = $state('webgpu');

  async function loadModel(scale: Scale, forceDevice?: 'webgpu' | 'wasm') {
    if (!lib) return;
    const targetDevice = forceDevice ?? (device === 'webgpu' ? 'webgpu' : 'wasm');
    if (pipeline && currentScale === scale && activeDevice === targetDevice) return;
    status = 'loading-model';
    loadProgress = 0;
    loadLabel = '';
    try {
      // Always use q8 quantization — Swin2SR fp32 weights are far too big for
      // most consumer WebGPU contexts (1-2 GB cap on integrated GPUs).
      pipeline = await lib.pipeline('image-to-image', MODELS[scale].id, {
        device: targetDevice,
        dtype: 'q8',
        progress_callback: (p: any) => {
          if (p.status === 'progress' && p.file) {
            loadProgress = Math.round(p.progress ?? 0);
            loadLabel = `${p.file} — ${loadProgress}%`;
          } else if (p.status === 'done' && p.file) {
            loadLabel = `${p.file} — done`;
          } else if (p.status === 'ready') {
            loadLabel = 'Ready';
          }
        },
      });
      currentScale = scale;
      activeDevice = targetDevice;
      status = 'ready';
    } catch (e: any) {
      console.error('[Upscaler] model load failed', e);
      errorMsg = e?.message || 'Failed to load the model.';
      status = 'error';
    }
  }

  /** Round down to the nearest multiple of `m`, but never below `m` itself. */
  function snap(value: number, m: number): number {
    return Math.max(m, Math.floor(value / m) * m);
  }

  async function fitWithinCap(bitmap: ImageBitmap, cap: number): Promise<{ bitmap: ImageBitmap; wasDownscaled: boolean }> {
    // First clamp to cap if needed
    let targetW = bitmap.width;
    let targetH = bitmap.height;
    const longest = Math.max(targetW, targetH);
    const overCap = longest > cap;
    if (overCap) {
      const scale = cap / longest;
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }

    // Then snap dimensions DOWN to multiples of SWIN_WINDOW so the model can
    // actually process the input. Without this, ONNX Runtime fails inside the
    // first attention block with a non-zero status code.
    const snappedW = snap(targetW, SWIN_WINDOW);
    const snappedH = snap(targetH, SWIN_WINDOW);

    const dimensionsChanged = snappedW !== bitmap.width || snappedH !== bitmap.height;
    if (!dimensionsChanged) {
      return { bitmap, wasDownscaled: false };
    }

    const canvas = document.createElement('canvas');
    canvas.width = snappedW;
    canvas.height = snappedH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, snappedW, snappedH);
    const newBitmap = await createImageBitmap(canvas);
    // Treat as "downscaled" only if we actually shrank below the original
    // (so the warning only shows for real shrinkage, not minor snap-to-grid).
    const wasDownscaled = overCap || snappedW < bitmap.width || snappedH < bitmap.height;
    return { bitmap: newBitmap, wasDownscaled };
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      errorMsg = 'Drop an image (JPG, PNG, WebP).';
      return;
    }
    errorMsg = '';
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = '';
    outputWidth = 0;
    outputHeight = 0;
    downscaled = false;
    originalName = file.name.replace(/\.[^.]+$/, '') + `-${pendingScale}x.png`;
    originalUrl = URL.createObjectURL(file);

    originalBitmap = await createImageBitmap(file);
    originalWidth = originalBitmap.width;
    originalHeight = originalBitmap.height;

    if (status === 'ready' || status === 'done') {
      await runUpscale();
    } else if (status !== 'loading-model') {
      await loadModel(pendingScale);
      if (status === 'ready') await runUpscale();
    }
  }

  function isOomError(e: any): boolean {
    const m = String(e?.message || e);
    return /memory|alloc|OrtRun|destination buffer is smaller|exceeds the maximum/i.test(m);
  }

  async function runUpscale() {
    if (!lib || !originalBitmap) return;
    errorMsg = '';

    // Ensure the right model is loaded for the chosen scale
    if (!pipeline || currentScale !== pendingScale) {
      await loadModel(pendingScale);
      if (status === 'error') return;
    }

    status = 'processing';

    const initialCap = pendingScale === 4 ? MAX_INPUT_DIM_4X : MAX_INPUT_DIM_2X;
    let cap = initialCap;
    let attempt = 0;
    let lastError: any = null;

    while (cap >= MIN_INPUT_DIM) {
      const { bitmap: inputBitmap, wasDownscaled } = await fitWithinCap(originalBitmap, cap);
      downscaled = wasDownscaled;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = inputBitmap.width;
        canvas.height = inputBitmap.height;
        canvas.getContext('2d')!.drawImage(inputBitmap, 0, 0);
        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
        const url = URL.createObjectURL(blob);

        const result = await pipeline(url);
        URL.revokeObjectURL(url);

        const outBitmap = await rawImageToBlobUrl(result);
        if (outputUrl) URL.revokeObjectURL(outputUrl);
        outputUrl = outBitmap.url;
        outputWidth = outBitmap.width;
        outputHeight = outBitmap.height;
        status = 'done';
        return;
      } catch (e: any) {
        lastError = e;
        if (!isOomError(e)) {
          console.error('[Upscaler] inference failed (non-OOM)', e);
          errorMsg = e?.message || 'Upscale failed.';
          status = 'error';
          return;
        }
        // OOM — halve the cap and try again
        attempt++;
        const nextCap = snap(Math.floor(cap * 0.66), SWIN_WINDOW);
        if (nextCap >= cap) {
          // No progress possible
          break;
        }
        console.warn(`[Upscaler] OOM at cap=${cap}, retrying at cap=${nextCap} (attempt ${attempt + 1})`);
        cap = nextCap;
      }
    }

    // WebGPU retries exhausted. If we were on WebGPU, fall back to WASM (CPU)
    // and try the largest cap once — WASM uses virtual memory and almost
    // always finishes, just slower.
    if (activeDevice === 'webgpu' && device === 'webgpu') {
      console.warn('[Upscaler] WebGPU exhausted, falling back to WASM');
      errorMsg = '';
      await loadModel(pendingScale, 'wasm');
      if (status === 'error') return;
      status = 'processing';
      const { bitmap: inputBitmap, wasDownscaled } = await fitWithinCap(
        originalBitmap,
        pendingScale === 4 ? MAX_INPUT_DIM_4X : MAX_INPUT_DIM_2X,
      );
      downscaled = wasDownscaled;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = inputBitmap.width;
        canvas.height = inputBitmap.height;
        canvas.getContext('2d')!.drawImage(inputBitmap, 0, 0);
        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
        const url = URL.createObjectURL(blob);
        const result = await pipeline(url);
        URL.revokeObjectURL(url);
        const outBitmap = await rawImageToBlobUrl(result);
        if (outputUrl) URL.revokeObjectURL(outputUrl);
        outputUrl = outBitmap.url;
        outputWidth = outBitmap.width;
        outputHeight = outBitmap.height;
        status = 'done';
        return;
      } catch (e2: any) {
        console.error('[Upscaler] WASM fallback also failed', e2);
        lastError = e2;
      }
    }

    console.error('[Upscaler] exhausted retries', lastError);
    errorMsg = pendingScale === 4
      ? 'Could not upscale this image, even on the CPU fallback. Try 2× mode (top-right) or a much smaller source image.'
      : 'Could not upscale this image, even on the CPU fallback. Try a much smaller source image (e.g. resize to ~500px first).';
    status = 'error';
  }

  async function rawImageToBlobUrl(raw: any): Promise<{ url: string; width: number; height: number }> {
    // transformers.js RawImage exposes .width, .height, .channels, .data
    const w = raw.width;
    const h = raw.height;
    const ch = raw.channels ?? 3;
    const data: Uint8Array | Uint8ClampedArray = raw.data;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    if (ch === 4) {
      imgData.data.set(data);
    } else if (ch === 3) {
      for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
        imgData.data[j] = data[i];
        imgData.data[j + 1] = data[i + 1];
        imgData.data[j + 2] = data[i + 2];
        imgData.data[j + 3] = 255;
      }
    } else if (ch === 1) {
      for (let i = 0, j = 0; i < data.length; i++, j += 4) {
        imgData.data[j] = data[i];
        imgData.data[j + 1] = data[i];
        imgData.data[j + 2] = data[i];
        imgData.data[j + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
    return { url: URL.createObjectURL(blob), width: w, height: h };
  }

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

  async function changeScale(s: Scale) {
    if (s === pendingScale) return;
    pendingScale = s;
    if (originalBitmap) {
      await runUpscale();
    } else {
      await loadModel(s);
    }
  }

  function reset() {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    originalUrl = '';
    outputUrl = '';
    originalBitmap = null;
    originalWidth = 0;
    originalHeight = 0;
    outputWidth = 0;
    outputHeight = 0;
    downscaled = false;
    errorMsg = '';
    status = pipeline ? 'ready' : 'idle';
  }

  function fmtPx(w: number, h: number): string {
    return `${w} × ${h}px`;
  }
</script>

<!-- Status bar -->
<div class="mb-6 flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
  <div class="flex items-center gap-3 text-sm flex-1 min-w-0">
    <span class={[
      'inline-block w-2 h-2 rounded-full flex-shrink-0',
      status === 'ready' || status === 'done' ? 'bg-[color:var(--color-success)]' :
      status === 'error' ? 'bg-[color:var(--color-danger)]' :
      'bg-[color:var(--color-warning)] animate-pulse'
    ]}></span>
    {#if status === 'idle'}
      <span class="text-[color:var(--color-text-mute)]">Initializing…</span>
    {:else if status === 'loading-model'}
      <span class="text-[color:var(--color-text-mute)] truncate">Loading {MODELS[pendingScale].label} model… <span class="font-mono text-xs">{loadLabel}</span></span>
    {:else if status === 'ready'}
      <span class="text-[color:var(--color-text)]">Ready</span>
    {:else if status === 'processing'}
      <span class="text-[color:var(--color-text)]">Upscaling…</span>
    {:else if status === 'done'}
      <span class="text-[color:var(--color-text)]">Done</span>
    {:else if status === 'error'}
      <span class="text-[color:var(--color-danger)] truncate">{errorMsg}</span>
    {/if}
  </div>

  <div class="flex items-center gap-2 flex-shrink-0">
    <div class="flex p-0.5 rounded-md bg-[color:var(--color-bg)] border border-[color:var(--color-border)]" title="2× is faster and gentler on memory; 4× extracts more detail">
      <button
        type="button"
        onclick={() => changeScale(2)}
        disabled={status === 'loading-model' || status === 'processing'}
        class={[
          'px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50',
          pendingScale === 2 ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
        ]}
      >2×</button>
      <button
        type="button"
        onclick={() => changeScale(4)}
        disabled={status === 'loading-model' || status === 'processing'}
        class={[
          'px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50',
          pendingScale === 4 ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
        ]}
      >4×</button>
    </div>
    <div class="text-[10px] text-[color:var(--color-text-dim)] font-mono uppercase tracking-wider">
      {device}{#if device === 'wasm'} <span class="text-[color:var(--color-warning)]">(slow)</span>{/if}
    </div>
  </div>
</div>

<!-- Drop zone -->
<button
  type="button"
  onclick={() => fileInput?.click()}
  ondrop={onDrop}
  ondragover={onDragOver}
  ondragleave={() => dragOver = false}
  disabled={status === 'loading-model' || status === 'processing'}
  class={[
    'w-full p-10 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3',
    (status === 'loading-model' || status === 'processing') ? 'cursor-wait opacity-60' : 'cursor-pointer',
    dragOver
      ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5'
      : 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-500)]/5'
  ]}
>
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[color:var(--color-text-mute)]">
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
  <div class="text-center">
    <p class="font-medium text-[color:var(--color-text)]">
      {dragOver ? 'Drop your image' : 'Drop an image to upscale'}
    </p>
    <p class="text-xs text-[color:var(--color-text-mute)] mt-1">
      JPG, PNG, WebP. Or paste from clipboard (Ctrl/Cmd + V). Runs on your device — never uploaded.
    </p>
  </div>
  <input bind:this={fileInput} type="file" accept="image/*" onchange={onPick} class="hidden" />
</button>

{#if status === 'loading-model'}
  <div class="mt-4 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
    <div class="flex justify-between text-xs text-[color:var(--color-text-mute)] mb-1.5">
      <span>First-time model download ({MODELS[pendingScale].size}, then cached)</span>
      <span class="font-mono">{loadProgress}%</span>
    </div>
    <div class="h-1.5 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
      <div class="h-full bg-[color:var(--color-brand-500)] transition-all" style:width={`${loadProgress}%`}></div>
    </div>
  </div>
{/if}

{#if originalUrl}
  <!-- Side-by-side preview -->
  <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-medium text-[color:var(--color-text-mute)] uppercase tracking-wider">Original</h3>
        {#if originalWidth}<span class="text-xs text-[color:var(--color-text-dim)] font-mono">{fmtPx(originalWidth, originalHeight)}</span>{/if}
      </div>
      <div class="rounded-lg overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] aspect-video flex items-center justify-center">
        <img src={originalUrl} alt="Original" class="max-w-full max-h-full object-contain" />
      </div>
    </div>
    <div>
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-medium text-[color:var(--color-text-mute)] uppercase tracking-wider">Upscaled</h3>
        {#if outputWidth}<span class="text-xs text-[color:var(--color-text-dim)] font-mono">{fmtPx(outputWidth, outputHeight)}</span>{/if}
      </div>
      <div class="rounded-lg overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] aspect-video flex items-center justify-center">
        {#if outputUrl}
          <img src={outputUrl} alt="Upscaled" class="max-w-full max-h-full object-contain" />
        {:else if status === 'processing'}
          <div class="flex flex-col items-center gap-2">
            <div class="w-6 h-6 rounded-full border-2 border-[color:var(--color-border-strong)] border-t-[color:var(--color-brand-500)] animate-spin"></div>
            <p class="text-xs text-[color:var(--color-text-dim)]">Working…</p>
          </div>
        {:else}
          <p class="text-xs text-[color:var(--color-text-dim)]">Waiting…</p>
        {/if}
      </div>
    </div>
  </div>

  {#if downscaled}
    <p class="mt-3 text-xs text-[color:var(--color-warning)] flex items-center gap-1.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Image was too large for safe GPU processing — it was downscaled before upscaling. Original aspect kept.
    </p>
  {/if}

  <!-- Actions -->
  <div class="mt-4 flex flex-wrap items-center gap-3 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
    <button
      onclick={runUpscale}
      disabled={status === 'processing' || status === 'loading-model'}
      class="px-4 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      Re-process
    </button>
    {#if outputUrl}
      <a
        href={outputUrl}
        download={originalName}
        class="px-4 py-2 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white text-sm font-medium transition-colors flex items-center gap-2 ml-auto"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download {pendingScale}× PNG
      </a>
    {/if}
    <button
      onclick={reset}
      class="px-3 py-2 rounded-lg border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] text-sm transition-colors"
    >
      Reset
    </button>
  </div>
{/if}
