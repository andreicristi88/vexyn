<script lang="ts">
  import { onMount } from 'svelte';
  import ErrorDisplay from '../ui/ErrorDisplay.svelte';

  type Status = 'idle' | 'loading-model' | 'ready' | 'processing' | 'done' | 'error';
  type Stage = 'encoding' | 'inferring' | 'generating' | 'compositing';

  const STAGES: { id: Stage; label: string; hint: string }[] = [
    { id: 'encoding', label: 'Encoding image', hint: 'Preparing pixels for the model.' },
    { id: 'inferring', label: 'Running AI model', hint: 'The slow part — your GPU is doing the work.' },
    { id: 'generating', label: 'Generating mask', hint: 'Building the transparency layer.' },
    { id: 'compositing', label: 'Finalizing', hint: 'Compositing the result.' },
  ];

  let lib: any = $state(null);
  let model: any = $state(null);
  let processor: any = $state(null);
  let device: 'webgpu' | 'wasm' = $state('wasm');
  let status: Status = $state('idle');
  let loadProgress = $state(0);
  let loadLabel = $state('');
  let currentStage = $state<Stage | null>(null);
  let errorMsg = $state('');

  let resolution: 512 | 1024 = $state(1024);
  let autoSpeed = $state(false);
  let processorBuilding = $state(false);

  let originalUrl = $state('');
  let originalName = $state('image.png');
  let outputUrl = $state('');
  let originalWidth = $state(0);
  let originalHeight = $state(0);

  let bgMode: 'transparent' | 'color' = $state('transparent');
  let bgColor = $state('#ffffff');

  const PRESET_COLORS = [
    { hex: '#ffffff', label: 'White' },
    { hex: '#000000', label: 'Black' },
    { hex: '#6366f1', label: 'Indigo' },
    { hex: '#a855f7', label: 'Purple' },
    { hex: '#10b981', label: 'Green' },
    { hex: '#ef4444', label: 'Red' },
    { hex: '#f59e0b', label: 'Amber' },
    { hex: '#3b82f6', label: 'Blue' },
  ];

  function pickPreset(hex: string) {
    bgMode = 'color';
    bgColor = hex;
  }
  let dragOver = $state(false);
  let fileInput: HTMLInputElement;
  let originalBitmap: ImageBitmap | null = null;
  let maskCache: any = null;

  const MODEL_ID = 'briaai/RMBG-1.4';

  function buildProcessor(size: number) {
    return lib.AutoProcessor.from_pretrained(MODEL_ID, {
      config: {
        do_normalize: true,
        do_pad: false,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        image_std: [1, 1, 1],
        resample: 2,
        rescale_factor: 0.00392156862745098,
        size: { width: size, height: size },
      },
    });
  }

  function detectSlowDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.matchMedia('(max-width: 768px)').matches;
    const lowCores = (navigator.hardwareConcurrency ?? 8) <= 4;
    // @ts-ignore
    const lowMem = (navigator.deviceMemory ?? 8) <= 4;
    return (coarsePointer && narrow) || lowCores || lowMem;
  }

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

  onMount(async () => {
    if (typeof window === 'undefined') return;
    window.addEventListener('paste', onClipboardPaste);
    status = 'loading-model';
    try {
      lib = await import('@huggingface/transformers');
      lib.env.allowLocalModels = false;
      lib.env.useBrowserCache = true;

      // Detect WebGPU
      // @ts-ignore
      device = (navigator.gpu && (await tryWebGPU())) ? 'webgpu' : 'wasm';

      // Auto-pick Speed on mobile / weak devices / WASM fallback
      if (detectSlowDevice() || device === 'wasm') {
        resolution = 512;
        autoSpeed = true;
      }

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

      processor = await buildProcessor(resolution);
      status = 'ready';
    } catch (e: any) {
      console.error('[BgRemover] init failed', e);
      errorMsg = e?.message || 'Failed to load the model.';
      status = 'error';
    }
  });

  async function setResolution(r: 512 | 1024) {
    if (r === resolution || !lib) return;
    autoSpeed = false;
    resolution = r;
    processorBuilding = true;
    try {
      processor = await buildProcessor(r);
    } finally {
      processorBuilding = false;
    }
  }

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
    errorMsg = '';

    try {
      currentStage = 'encoding';
      const image = await lib.RawImage.fromURL(originalUrl);
      const { pixel_values } = await processor(image);

      currentStage = 'inferring';
      // Yield so the UI can paint the new stage before the GPU blocks the thread
      await new Promise((r) => setTimeout(r, 0));
      const { output } = await model({ input: pixel_values });

      currentStage = 'generating';
      const mask = await lib.RawImage.fromTensor(
        output[0].mul(255).to('uint8'),
      ).resize(image.width, image.height);
      maskCache = { mask, w: image.width, h: image.height };

      currentStage = 'compositing';
      renderOutput();

      currentStage = null;
      status = 'done';
    } catch (e: any) {
      console.error('[BgRemover] inference failed', e);
      errorMsg = e?.message || 'Inference failed.';
      currentStage = null;
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
<div class="mb-4 p-3 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-3">
  <div class="flex items-center justify-between gap-3 text-sm">
    <div class="flex items-center gap-3 min-w-0">
      <span class={[
        'inline-block w-2 h-2 rounded-full flex-shrink-0',
        status === 'ready' || status === 'done' ? 'bg-[color:var(--color-success)]' :
        status === 'error' ? 'bg-[color:var(--color-danger)]' :
        'bg-[color:var(--color-warning)] animate-pulse'
      ]}></span>
      {#if status === 'idle'}
        <span class="text-[color:var(--color-text-mute)]">Initializing…</span>
      {:else if status === 'loading-model'}
        <span class="text-[color:var(--color-text-mute)] truncate">Loading model… <span class="font-mono text-xs">{loadLabel}</span></span>
      {:else if status === 'ready'}
        <span class="text-[color:var(--color-text)]">Ready</span>
      {:else if status === 'processing' && currentStage}
        {@const cur = STAGES.find((s) => s.id === currentStage)!}
        <span class="text-[color:var(--color-text)]">{cur.label}<span class="ml-1 text-[color:var(--color-text-dim)]">— {cur.hint}</span></span>
      {:else if status === 'done'}
        <span class="text-[color:var(--color-text)]">Done</span>
      {:else if status === 'error'}
        <span class="text-[color:var(--color-danger)] truncate">{errorMsg}</span>
      {/if}
    </div>
    <div class="flex items-center gap-2 flex-shrink-0">
      <!-- Quality / Speed toggle -->
      <div class="flex p-0.5 rounded-md bg-[color:var(--color-bg)] border border-[color:var(--color-border)]" title="Lower resolution = faster inference, slightly softer mask">
        <button
          type="button"
          onclick={() => setResolution(1024)}
          disabled={processorBuilding}
          class={[
            'px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50',
            resolution === 1024 ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
          ]}
        >Quality</button>
        <button
          type="button"
          onclick={() => setResolution(512)}
          disabled={processorBuilding}
          class={[
            'px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50',
            resolution === 512 ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
          ]}
        >Speed</button>
      </div>
      <div class="text-[10px] text-[color:var(--color-text-dim)] font-mono uppercase tracking-wider">
        {device}{#if device === 'wasm'} <span class="text-[color:var(--color-warning)]">(slow)</span>{/if}
      </div>
    </div>
  </div>

  <!-- Stage track during processing -->
  {#if status === 'processing'}
    <div class="flex items-center gap-1.5">
      {#each STAGES as s, i}
        {@const done = currentStage ? STAGES.findIndex((x) => x.id === currentStage) > i : false}
        {@const active = currentStage === s.id}
        <div class={[
          'h-1 flex-1 rounded-full transition-colors',
          done ? 'bg-[color:var(--color-brand-500)]' :
          active ? 'bg-[color:var(--color-brand-500)] animate-pulse' :
          'bg-[color:var(--color-surface-2)]'
        ]}></div>
      {/each}
    </div>
  {/if}

  {#if autoSpeed && status === 'ready'}
    <p class="text-[11px] text-[color:var(--color-text-dim)] flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      Auto-picked <strong class="text-[color:var(--color-text-mute)]">Speed</strong> mode for your device. Switch to Quality for a sharper mask if you have time.
    </p>
  {/if}
</div>

<!-- Drop zone -->
<button
  type="button"
  onclick={() => fileInput?.click()}
  ondrop={onDrop}
  ondragover={onDragOver}
  ondragleave={() => dragOver = false}
  disabled={status === 'loading-model'}
  class={[
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
      JPG, PNG, WebP. Or paste from clipboard (Ctrl/Cmd + V). Image never uploaded.
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

  <!-- Skeleton preview while the model is downloading: same layout as the
       real side-by-side so the page doesn't jump when an image is added. -->
  <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50 select-none pointer-events-none" aria-hidden="true">
    <div>
      <div class="h-4 w-20 rounded bg-[color:var(--color-surface-2)] mb-2 animate-pulse"></div>
      <div class="rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] aspect-video"></div>
    </div>
    <div>
      <div class="h-4 w-32 rounded bg-[color:var(--color-surface-2)] mb-2 animate-pulse"></div>
      <div
        class="rounded-lg border border-[color:var(--color-border)] aspect-video"
        style:background="repeating-conic-gradient(#2a2a36 0% 25%, #1c1c26 0% 50%) 50% / 24px 24px"
      ></div>
    </div>
  </div>
{/if}

{#if status === 'error' && errorMsg}
  <ErrorDisplay
    message={errorMsg}
    hint={errorMsg.toLowerCase().includes('webgpu') || errorMsg.toLowerCase().includes('fetch') || errorMsg.toLowerCase().includes('network')
      ? 'Check your internet connection. The model is ~85 MB and downloaded once from huggingface.co — corporate firewalls sometimes block it.'
      : errorMsg.toLowerCase().includes('memory') || errorMsg.toLowerCase().includes('alloc')
      ? 'Try the Speed (512px) mode in the top-right toggle — it uses about a quarter of the memory.'
      : 'Try refreshing the page. If it keeps failing, the GPU may be busy — try again in a moment.'}
    onRetry={() => { if (originalUrl) process(); }}
    issueTitle="Background Remover failed"
  />
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
          {@const cur = currentStage ? STAGES.find((s) => s.id === currentStage) : null}
          <div class="flex flex-col items-center gap-2">
            <div class="w-6 h-6 rounded-full border-2 border-[color:var(--color-border-strong)] border-t-[color:var(--color-brand-500)] animate-spin"></div>
            <p class="text-xs text-[color:var(--color-text-mute)]">{cur?.label ?? 'Working…'}</p>
          </div>
        {:else}
          <p class="text-xs text-[color:var(--color-text-dim)]">Waiting…</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Background options + actions -->
  <div class="mt-4 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
    <!-- Row 1: mode toggle -->
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-xs font-medium text-[color:var(--color-text-mute)] uppercase tracking-wider w-24">Background</span>
      <div class="flex p-0.5 rounded-md bg-[color:var(--color-bg)] border border-[color:var(--color-border)]">
        <button
          onclick={() => bgMode = 'transparent'}
          class={[
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            bgMode === 'transparent' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
          ]}
        >
          Transparent
        </button>
        <button
          onclick={() => bgMode = 'color'}
          class={[
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            bgMode === 'color' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
          ]}
        >
          Color
        </button>
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

    <!-- Row 2: color selection (only when mode = color) -->
    {#if bgMode === 'color'}
      <div class="flex flex-wrap items-center gap-3 pt-3 border-t border-[color:var(--color-border)]">
        <span class="text-xs font-medium text-[color:var(--color-text-mute)] uppercase tracking-wider w-24">Color</span>

        <!-- Preset swatches -->
        <div class="flex flex-wrap items-center gap-1.5">
          {#each PRESET_COLORS as p (p.hex)}
            <button
              type="button"
              onclick={() => pickPreset(p.hex)}
              aria-label={`Set background to ${p.label}`}
              title={p.label}
              class={[
                'w-7 h-7 rounded-md transition-all',
                bgColor.toLowerCase() === p.hex.toLowerCase()
                  ? 'ring-2 ring-offset-2 ring-offset-[color:var(--color-surface)] ring-[color:var(--color-brand-500)] scale-110'
                  : 'ring-1 ring-[color:var(--color-border-strong)] hover:scale-110 hover:ring-[color:var(--color-text-mute)]'
              ]}
              style:background={p.hex}
            ></button>
          {/each}
        </div>

        <!-- Custom color picker with hex display -->
        <div class="flex items-center gap-2 ml-auto">
          <label class="relative flex items-center gap-2 cursor-pointer group" title="Pick custom color">
            <input
              type="color"
              bind:value={bgColor}
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Custom background color"
            />
            <div
              class="w-9 h-9 rounded-md ring-1 ring-[color:var(--color-border-strong)] group-hover:ring-[color:var(--color-text-mute)] transition-all flex items-center justify-center"
              style:background={bgColor}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white mix-blend-difference">
                <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/>
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
              </svg>
            </div>
            <span class="text-xs font-mono text-[color:var(--color-text-mute)] group-hover:text-[color:var(--color-text)] transition-colors uppercase">
              {bgColor}
            </span>
          </label>
        </div>
      </div>
    {/if}
  </div>
{/if}
