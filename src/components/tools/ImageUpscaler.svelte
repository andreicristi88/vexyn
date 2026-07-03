<script lang="ts">
  import { onMount } from 'svelte';

  type Status = 'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error';

  const MODEL_ID = 'Xenova/swin2SR-classical-sr-x2-64';
  const MAX_INPUT_SIDE = 768;

  let lib: any = $state(null);
  let pipeline: any = $state(null);
  let status: Status = $state('idle');
  let loadProgress = $state(0);
  let loadLabel = $state('');
  let device: 'webgpu' | 'wasm' = $state('wasm');
  let fellBackToWasm = $state(false);
  let errorMsg = $state('');

  let originalUrl = $state('');
  let outputUrl = $state('');
  let originalName = $state('image.png');
  let originalWidth = $state(0);
  let originalHeight = $state(0);
  let outputWidth = $state(0);
  let outputHeight = $state(0);
  let elapsedSec = $state(0);
  let scale = $state<2 | 4>(2);
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      lib = await import('@huggingface/transformers');
      status = 'loading';
      loadLabel = 'Detecting hardware…';
      const supportsWebGPU = 'gpu' in navigator;
      device = supportsWebGPU ? 'webgpu' : 'wasm';
      loadLabel = `Downloading model (~30 MB)…`;
      pipeline = await lib.pipeline('image-to-image', MODEL_ID, {
        device,
        dtype: 'fp32',
        progress_callback: (p: any) => {
          if (p.status === 'progress' && p.progress !== undefined) {
            loadProgress = Math.round(p.progress);
            loadLabel = `Downloading model… ${loadProgress}%`;
          }
          if (p.status === 'done') loadLabel = 'Model cached, ready.';
        },
      });
      status = 'ready';
    } catch (e: any) {
      status = 'error';
      errorMsg = `Could not load model: ${e?.message ?? e}`;
      console.error('[Upscaler] init failed', e);
    }
  });

  async function pickFile(file: File) {
    revoke();
    errorMsg = '';
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      errorMsg = 'Drop a PNG, JPG, or WebP image.';
      return;
    }
    originalName = file.name;
    originalUrl = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = originalUrl; });
    originalWidth = img.naturalWidth;
    originalHeight = img.naturalHeight;
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

  function tooLarge() {
    return Math.max(originalWidth, originalHeight) > MAX_INPUT_SIDE;
  }

  async function runPipeline(rawImage: any) {
    try {
      return await pipeline(rawImage);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      // WebGPU device-lost or OOM — reload the pipeline with CPU fallback and retry once.
      if (device === 'webgpu' && /device.*lost|out of memory|OrtRun|WebGPU/i.test(msg)) {
        console.warn('[Upscaler] WebGPU failed, falling back to WASM:', msg);
        loadLabel = 'GPU out of memory — switching to CPU. This will be slower…';
        device = 'wasm';
        fellBackToWasm = true;
        pipeline = await lib.pipeline('image-to-image', MODEL_ID, {
          device: 'wasm',
          dtype: 'fp32',
        });
        return await pipeline(rawImage);
      }
      throw e;
    }
  }

  async function upscale() {
    if (!pipeline || !originalUrl) return;
    status = 'processing';
    errorMsg = '';
    const start = performance.now();
    try {
      const rawImage = await lib.RawImage.fromURL(originalUrl);
      let out = await runPipeline(rawImage);
      // For 4x, run through pipeline twice (2x + 2x)
      if (scale === 4) {
        out = await runPipeline(out);
      }
      // Convert output to canvas → blob → object URL
      const canvas = document.createElement('canvas');
      canvas.width = out.width;
      canvas.height = out.height;
      const ctx = canvas.getContext('2d')!;
      const imgData = ctx.createImageData(out.width, out.height);
      const src = out.data as Uint8Array;
      const dst = imgData.data;
      if (out.channels === 3) {
        for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
          dst[j] = src[i];
          dst[j + 1] = src[i + 1];
          dst[j + 2] = src[i + 2];
          dst[j + 3] = 255;
        }
      } else {
        dst.set(src);
      }
      ctx.putImageData(imgData, 0, 0);
      outputWidth = out.width;
      outputHeight = out.height;
      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/png'));
      outputUrl = URL.createObjectURL(blob);
      elapsedSec = Math.round((performance.now() - start) / 100) / 10;
      status = 'done';
    } catch (e: any) {
      status = 'error';
      errorMsg = `Upscale failed: ${e?.message ?? e}`;
      console.error('[Upscaler] failed', e);
    }
  }

  function revoke() {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    originalUrl = '';
    outputUrl = '';
    outputWidth = 0;
    outputHeight = 0;
  }

  function reset() {
    revoke();
    originalWidth = 0;
    originalHeight = 0;
    errorMsg = '';
    if (status !== 'error') status = 'ready';
  }
</script>

<div class="space-y-4">
  {#if status === 'loading' || status === 'idle'}
    <div class="p-6 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-8 h-8 rounded-full border-2 border-[color:var(--color-brand-500)] border-t-transparent animate-spin"></div>
        <p class="text-sm font-medium">{loadLabel || 'Initialising…'}</p>
      </div>
      {#if loadProgress > 0}
        <div class="w-full h-1.5 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
          <div class="h-full bg-[color:var(--color-brand-500)] transition-all" style="width: {loadProgress}%"></div>
        </div>
      {/if}
      <p class="text-xs text-[color:var(--color-text-mute)] mt-2">Model is ~30 MB — cached after first load, subsequent visits start instantly.</p>
    </div>
  {/if}

  {#if status === 'ready' || status === 'processing' || status === 'done'}
    <div class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="Image drop zone">
      {#if !originalUrl}
        <p class="text-[color:var(--color-text-mute)] mb-3">Drop a PNG, JPG or WebP image, or</p>
        <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium" on:click={() => fileInput.click()}>Choose image</button>
        <input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/webp" class="hidden" on:change={onPick} />
      {:else}
        <p class="font-medium mb-1">{originalName}</p>
        <p class="text-xs text-[color:var(--color-text-mute)]">{originalWidth}×{originalHeight}px</p>
        <button class="mt-2 text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={reset}>Choose a different image</button>
      {/if}
    </div>

    {#if originalUrl && !outputUrl}
      <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
        {#if tooLarge()}
          <div class="p-3 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">
            Input is larger than {MAX_INPUT_SIDE}px on the long side. Upscale would likely exceed browser GPU memory. Resize your image down first, or try the CPU fallback (slower but supports larger inputs — will trigger automatically if GPU fails).
          </div>
        {/if}

        <div>
          <p class="text-sm font-semibold mb-2">Scale</p>
          <div class="grid grid-cols-2 gap-2">
            <button class="p-3 rounded-lg border text-sm font-medium transition-colors {scale === 2 ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10 text-[color:var(--color-brand-400)]' : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]'}" on:click={() => (scale = 2)}>
              2× ({originalWidth * 2}×{originalHeight * 2})
            </button>
            <button class="p-3 rounded-lg border text-sm font-medium transition-colors {scale === 4 ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10 text-[color:var(--color-brand-400)]' : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]'}" on:click={() => (scale = 4)}>
              4× ({originalWidth * 4}×{originalHeight * 4})
            </button>
          </div>
          <p class="text-xs text-[color:var(--color-text-mute)] mt-2">4× runs the 2× model twice — slower but sharper.</p>
        </div>

        <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={upscale} disabled={status === 'processing' || tooLarge()}>
          {status === 'processing' ? 'Upscaling…' : `Upscale ${scale}×`}
        </button>
        {#if status === 'processing'}
          <p class="text-xs text-[color:var(--color-text-mute)] text-center">
            Running on {device === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WASM)'}.
            {fellBackToWasm ? 'GPU ran out of memory — using CPU instead (slower but reliable).' : 'Larger images take longer.'}
          </p>
        {/if}
      </div>
    {/if}

    {#if outputUrl}
      <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-semibold">Upscaled!</p>
            <p class="text-sm text-[color:var(--color-text-mute)]">
              {originalWidth}×{originalHeight} → <strong class="text-[color:var(--color-success)]">{outputWidth}×{outputHeight}</strong>
              <span class="ml-1">in {elapsedSec}s</span>
            </p>
          </div>
          <a href={outputUrl} download={originalName.replace(/(\.[^.]+)$/, `.upscaled-${scale}x$1`)} class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2 whitespace-nowrap">
            Download PNG
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <div>
            <p class="text-xs text-[color:var(--color-text-mute)] mb-1">Original</p>
            <img src={originalUrl} alt="Original" class="w-full aspect-square object-contain rounded bg-white" />
          </div>
          <div>
            <p class="text-xs text-[color:var(--color-text-mute)] mb-1">Upscaled</p>
            <img src={outputUrl} alt="Upscaled" class="w-full aspect-square object-contain rounded bg-white" />
          </div>
        </div>
      </div>
    {/if}
  {/if}

  {#if errorMsg}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{errorMsg}</div>
  {/if}
</div>
