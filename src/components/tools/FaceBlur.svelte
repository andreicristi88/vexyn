<script lang="ts">
  import { onMount } from 'svelte';

  type Status = 'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error';

  let mp: any = $state(null);
  let detector: any = $state(null);
  let status: Status = $state('idle');
  let loadLabel = $state('');
  let errorMsg = $state('');

  let originalUrl = $state('');
  let outputUrl = $state('');
  let originalName = $state('image.png');
  let originalWidth = $state(0);
  let originalHeight = $state(0);
  let facesFound = $state(0);
  let mode = $state<'blur' | 'pixelate' | 'block'>('blur');
  let intensity = $state(30);
  let padding = $state(1.4);
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      status = 'loading';
      loadLabel = 'Loading MediaPipe FaceDetector (~5 MB)…';
      mp = await import('@mediapipe/tasks-vision');
      const vision = await mp.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      detector = await mp.FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
      status = 'ready';
    } catch (e: any) {
      status = 'error';
      errorMsg = `Could not load face detector: ${e?.message ?? e}`;
      console.error('[FaceBlur] init failed', e);
    }
  });

  async function pickFile(f: File) {
    revoke();
    errorMsg = '';
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(f.type) && !/\.(png|jpe?g|webp)$/i.test(f.name)) {
      errorMsg = 'Drop a PNG, JPG, or WebP image.';
      return;
    }
    originalName = f.name;
    originalUrl = URL.createObjectURL(f);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = originalUrl; });
    originalWidth = img.naturalWidth;
    originalHeight = img.naturalHeight;
    facesFound = 0;
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

  async function process() {
    if (!detector || !originalUrl) return;
    status = 'processing';
    errorMsg = '';
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = originalUrl; });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const result = detector.detect(img);
      const detections = result.detections ?? [];
      facesFound = detections.length;

      if (facesFound === 0) {
        status = 'done';
        // Output = original (no faces to blur)
        canvas.toBlob((b) => {
          if (b) outputUrl = URL.createObjectURL(b);
        }, 'image/png');
        return;
      }

      // Apply the chosen effect to each detected face
      for (const d of detections) {
        const bbox = d.boundingBox;
        // Grow the box by padding factor so hair/edges are covered too
        const cx = bbox.originX + bbox.width / 2;
        const cy = bbox.originY + bbox.height / 2;
        const w = bbox.width * padding;
        const h = bbox.height * padding;
        const x = Math.max(0, Math.floor(cx - w / 2));
        const y = Math.max(0, Math.floor(cy - h / 2));
        const width = Math.min(canvas.width - x, Math.floor(w));
        const height = Math.min(canvas.height - y, Math.floor(h));
        if (width <= 0 || height <= 0) continue;

        if (mode === 'blur') {
          applyBlur(ctx, x, y, width, height, intensity);
        } else if (mode === 'pixelate') {
          applyPixelate(ctx, x, y, width, height, Math.max(4, Math.round(intensity / 3)));
        } else {
          applyBlock(ctx, x, y, width, height);
        }
      }

      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/png'));
      outputUrl = URL.createObjectURL(blob);
      status = 'done';
    } catch (e: any) {
      status = 'error';
      errorMsg = `Face blur failed: ${e?.message ?? e}`;
      console.error('[FaceBlur] failed', e);
    }
  }

  function applyBlur(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
    // Extract region, blur via canvas filter, paint back
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d')!;
    tctx.filter = `blur(${radius}px)`;
    tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
    ctx.drawImage(tmp, 0, 0, w, h, x, y, w, h);
  }
  function applyPixelate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, block: number) {
    const smallW = Math.max(1, Math.floor(w / block));
    const smallH = Math.max(1, Math.floor(h / block));
    const tmp = document.createElement('canvas');
    tmp.width = smallW;
    tmp.height = smallH;
    const tctx = tmp.getContext('2d')!;
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, smallW, smallH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, smallW, smallH, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
  }
  function applyBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = 'black';
    ctx.fillRect(x, y, w, h);
  }

  function revoke() {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    originalUrl = '';
    outputUrl = '';
    facesFound = 0;
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
      <p class="text-xs text-[color:var(--color-text-mute)] mt-2">MediaPipe face detector is ~5 MB — cached after first load.</p>
    </div>
  {/if}

  {#if status !== 'idle' && status !== 'loading'}
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
        <div>
          <p class="text-sm font-semibold mb-2">Anonymization mode</p>
          <div class="grid grid-cols-3 gap-2">
            <button class="p-3 rounded-lg border text-sm font-medium transition-colors {mode === 'blur' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)]'}" on:click={() => (mode = 'blur')}>Blur</button>
            <button class="p-3 rounded-lg border text-sm font-medium transition-colors {mode === 'pixelate' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)]'}" on:click={() => (mode = 'pixelate')}>Pixelate</button>
            <button class="p-3 rounded-lg border text-sm font-medium transition-colors {mode === 'block' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)]'}" on:click={() => (mode = 'block')}>Solid black</button>
          </div>
        </div>

        {#if mode !== 'block'}
          <label class="block text-sm">
            <span class="font-semibold block mb-1">Intensity: <span class="text-[color:var(--color-brand-400)]">{intensity}</span></span>
            <input type="range" min="5" max="80" step="1" bind:value={intensity} class="w-full" />
          </label>
        {/if}

        <label class="block text-sm">
          <span class="font-semibold block mb-1">Coverage padding: <span class="text-[color:var(--color-brand-400)]">{padding.toFixed(2)}×</span></span>
          <input type="range" min="1" max="2" step="0.05" bind:value={padding} class="w-full" />
          <p class="text-xs text-[color:var(--color-text-mute)] mt-1">Higher padding covers hair, ears, glasses.</p>
        </label>

        <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={process} disabled={status === 'processing'}>
          {status === 'processing' ? 'Detecting faces…' : 'Detect and anonymize faces'}
        </button>
      </div>
    {/if}

    {#if outputUrl}
      <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-semibold">{facesFound === 0 ? 'No faces detected' : `${facesFound} face${facesFound > 1 ? 's' : ''} anonymized`}</p>
            {#if facesFound === 0}
              <p class="text-sm text-[color:var(--color-text-mute)]">Output identical to input.</p>
            {:else}
              <p class="text-sm text-[color:var(--color-text-mute)]">Mode: {mode}, padding {padding.toFixed(2)}×</p>
            {/if}
          </div>
          <a href={outputUrl} download={originalName.replace(/(\.[^.]+)$/, `.anonymized$1`)} class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2 whitespace-nowrap">
            Download
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        </div>
        <img src={outputUrl} alt="Anonymized" class="w-full max-h-[500px] object-contain rounded bg-white" />
      </div>
    {/if}
  {/if}

  {#if errorMsg}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{errorMsg}</div>
  {/if}
</div>
