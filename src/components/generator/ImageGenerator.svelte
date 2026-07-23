<script lang="ts">
  import { MODEL_BASE, MODEL } from '../../lib/constants';
  import { buildPrompt, type Preset } from '../../lib/styles';

  let { preset }: { preset: Preset } = $props();

  type Phase = 'probe' | 'choose' | 'idle' | 'loading' | 'ready' | 'generating';
  /** How images get made on this device:
   *  webgpu — local, fast, unlimited (desktop happy path)
   *  wasm   — local on CPU, unlimited but slow (fallback, user opted in)
   *  server — our Workers AI endpoint, fast but daily-capped (user opted in) */
  type Mode = 'webgpu' | 'wasm' | 'server';
  type Shot = { url: string; prompt: string; seed: number; ms: number };

  const PARTS = ['text_encoder', 'unet', 'vae_decoder'] as const;
  type Part = (typeof PARTS)[number];

  const CACHE = 'vexyn-sdxs-v1';
  const LATENT = 64; // 512 / 8

  let phase = $state<Phase>('probe');
  let mode = $state<Mode>('webgpu');
  let gpuName = $state('');
  let unsupportedReason = $state('');
  let serverRemaining = $state<number | null>(null);

  let prompt = $state('');
  let seed = $state(Math.floor(Math.random() * 1e6));
  let lockSeed = $state(false);

  let bytesDone = $state(0);
  let bytesTotal = $state(0);
  let loadingLabel = $state('');
  let mbps = $state(0);

  let shots = $state<Shot[]>([]);
  let error = $state('');
  let lastMs = $state(0);

  // Not reactive — these are heavy handles, never rendered.
  let ort: any = null;
  let cfg: any = null;
  let tokenizer: any = null;
  const sessions: Partial<Record<Part, any>> = {};
  let alphasCumprod: Float64Array | null = null;

  const pct = $derived(bytesTotal ? Math.min(100, (bytesDone / bytesTotal) * 100) : 0);
  const mb = (b: number) => (b / 1048576).toFixed(0);
  const etaSec = $derived(
    mbps > 0 && bytesTotal > bytesDone ? Math.round((bytesTotal - bytesDone) / 1048576 / mbps) : 0,
  );

  // ---- fp16 helpers -------------------------------------------------------
  // ORT Web >= 1.20 wants a native Float16Array; older engines take raw Uint16.
  const F16 = (globalThis as any).Float16Array ?? null;

  function toHalfBits(v: number): number {
    const f = new Float32Array(1);
    const i = new Int32Array(f.buffer);
    f[0] = v;
    const x = i[0];
    let bits = (x >> 16) & 0x8000;
    let m = (x >> 12) & 0x07ff;
    const e = (x >> 23) & 0xff;
    if (e < 103) return bits;
    if (e > 142) return bits | 0x7c00;
    if (e < 113) {
      m |= 0x0800;
      return bits | ((m >> (114 - e)) + ((m >> (113 - e)) & 1));
    }
    bits |= ((e - 112) << 10) | (m >> 1);
    return bits + (m & 1);
  }
  function halfToNum(h: number): number {
    const s = h & 0x8000 ? -1 : 1;
    const e = (h & 0x7c00) >> 10;
    const f = h & 0x03ff;
    if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
    if (e === 0x1f) return f ? NaN : s * Infinity;
    return s * Math.pow(2, e - 15) * (1 + f / 1024);
  }
  const asHalf = (a: Float32Array) => {
    if (F16) return F16.from(a);
    const o = new Uint16Array(a.length);
    for (let i = 0; i < a.length; i++) o[i] = toHalfBits(a[i]);
    return o;
  };
  /** Any tensor → Float32Array, whatever precision it came back in. */
  function asF32(t: any): Float32Array {
    const d = t.data;
    if (d instanceof Float32Array) return d;
    if (F16 && d instanceof F16) return Float32Array.from(d as any);
    if (t.type === 'float16' && d instanceof Uint16Array) {
      const o = new Float32Array(d.length);
      for (let i = 0; i < d.length; i++) o[i] = halfToNum(d[i]);
      return o;
    }
    return Float32Array.from(d);
  }
  /** ORT reports fp32 as "float"; normalise to the name ORT Web expects. */
  const ioType = (part: Part, name: string, dir: 'inputs' | 'outputs' = 'inputs') => {
    const t = cfg?.io?.[part]?.[dir]?.[name];
    return t === 'float' ? 'float32' : t ?? null;
  };
  const mkTensor = (dtype: string | null, arr: Float32Array, dims: number[]) =>
    dtype === 'float32'
      ? new ort.Tensor('float32', arr, dims)
      : new ort.Tensor('float16', asHalf(arr), dims);

  /** Seeded Box–Muller so a given seed always reproduces the same image. */
  function randn(n: number, s: number): Float32Array {
    let st = s >>> 0;
    const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0), st / 4294967296);
    const o = new Float32Array(n);
    for (let i = 0; i < n; i += 2) {
      const u = Math.max(rnd(), 1e-7);
      const v = rnd();
      const r = Math.sqrt(-2 * Math.log(u));
      o[i] = r * Math.cos(2 * Math.PI * v);
      if (i + 1 < n) o[i + 1] = r * Math.sin(2 * Math.PI * v);
    }
    return o;
  }

  /** scaled_linear β schedule → ᾱ. DEIS uses the DDPM convention, not Euler. */
  function buildAlphas(sc: any): Float64Array {
    const N = sc?.num_train_timesteps ?? 1000;
    const bs = Math.sqrt(sc?.beta_start ?? 0.00085);
    const be = Math.sqrt(sc?.beta_end ?? 0.012);
    let ac = 1;
    const out = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const b = bs + ((be - bs) * i) / (N - 1);
      ac *= 1 - b * b;
      out[i] = ac;
    }
    return out;
  }

  // ---- boot ---------------------------------------------------------------
  $effect(() => {
    probe();
  });

  async function probe() {
    if (!('gpu' in navigator)) {
      unsupportedReason =
        'This browser has no WebGPU (common on phones and older browsers).';
      phase = 'choose';
      return;
    }
    try {
      const adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) {
        unsupportedReason = 'WebGPU exists here, but the system offered no graphics adapter — your GPU is likely blocklisted.';
        phase = 'choose';
        return;
      }
      const info = adapter.info ?? (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
      gpuName = [info.vendor, info.architecture].filter(Boolean).join(' ') || 'your GPU';
      mode = 'webgpu';
      phase = 'idle';
    } catch (e: any) {
      unsupportedReason = e?.message ?? 'WebGPU failed to initialise.';
      phase = 'choose';
    }
  }

  function chooseServer() {
    mode = 'server';
    phase = 'ready'; // nothing to load — the server has the model
  }

  function chooseWasm() {
    mode = 'wasm';
    phase = 'idle'; // same download flow, CPU execution
  }

  /** Files that make up one component. Wrangler caps uploads at 300 MiB, so
   *  the unet ships as byte-split chunks the client re-concatenates. */
  function filesFor(part: Part): Array<{ path: string; bytes: number }> {
    return cfg?.files?.[part] ?? [{ path: `${part}/model.onnx`, bytes: 0 }];
  }

  async function fetchPart(part: Part, onChunk: (delta: number) => void) {
    const files = filesFor(part);
    const cache = await caches.open(CACHE);
    const totalBytesPart = files.reduce((a, f) => a + f.bytes, 0);
    const out = totalBytesPart ? new Uint8Array(totalBytesPart) : null;
    let offset = 0;
    const chunks: Uint8Array[] = [];

    for (const file of files) {
      const url = `${MODEL_BASE}/${file.path}`;
      const hit = await cache.match(url);
      if (hit) {
        const buf = new Uint8Array(await hit.arrayBuffer());
        if (out) out.set(buf, offset);
        else chunks.push(buf);
        offset += buf.byteLength;
        onChunk(buf.byteLength);
        continue;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${file.path}: HTTP ${res.status}`);
      // Cache the clone by streaming — never materialise a second copy in the heap.
      cache.put(url, res.clone()).catch(() => {});
      const reader = res.body!.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (out) out.set(value, offset);
        else chunks.push(value);
        offset += value.length;
        onChunk(value.length);
      }
    }

    if (out) return out.buffer;
    // Manifest lacked sizes — assemble from collected chunks.
    const buf = new Uint8Array(offset);
    let o = 0;
    for (const c of chunks) {
      buf.set(c, o);
      o += c.length;
    }
    return buf.buffer;
  }

  async function load() {
    phase = 'loading';
    error = '';
    const started = performance.now();
    try {
      loadingLabel = 'Reading model manifest';
      const manifest = await fetch(`${MODEL_BASE}/runtime.json`);
      if (!manifest.ok) throw new Error(`manifest: HTTP ${manifest.status}`);
      cfg = await manifest.json();
      alphasCumprod = buildAlphas(cfg.scheduler_config);
      bytesTotal = PARTS.reduce((a, p) => {
        const fromFiles = filesFor(p).reduce((s, f) => s + f.bytes, 0);
        return a + (fromFiles || (cfg.sizes_mb?.[p] ?? 0) * 1048576);
      }, 0);

      loadingLabel = 'Starting the runtime';
      ort = await import('onnxruntime-web/webgpu');
      if (mode === 'wasm') {
        // No COOP/COEP on the site (ads-compatible), so no threads. SIMD is on
        // by default and is what makes single-thread tolerable at all.
        ort.env.wasm.numThreads = 1;
      }

      let done = 0;
      for (const part of PARTS) {
        loadingLabel = `Downloading ${part.replace('_', ' ')}`;
        const buf = await fetchPart(part, (delta) => {
          done += delta;
          bytesDone = done;
          const secs = (performance.now() - started) / 1000;
          if (secs > 0.5) mbps = done / 1048576 / secs;
        });
        loadingLabel = `Preparing ${part.replace('_', ' ')} — this freezes briefly`;
        await new Promise((r) => setTimeout(r, 60)); // let the label paint
        sessions[part] = await ort.InferenceSession.create(buf, {
          executionProviders: mode === 'wasm' ? ['wasm'] : ['webgpu'],
          graphOptimizationLevel: 'all',
        });
      }

      loadingLabel = 'Loading tokenizer';
      const { AutoTokenizer } = await import('@huggingface/transformers');
      tokenizer = await AutoTokenizer.from_pretrained('Xenova/clip-vit-large-patch14');

      phase = 'ready';
    } catch (e: any) {
      error = e?.message ?? String(e);
      phase = 'idle';
    }
  }

  async function generateServer() {
    const t0 = performance.now();
    const full = buildPrompt(preset, prompt);
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: full, seed }),
    });
    const data = await res.json().catch(() => ({}) as any);
    if (!res.ok) throw new Error(data?.message ?? data?.error ?? `server error ${res.status}`);
    serverRemaining = data.remaining ?? null;
    lastMs = performance.now() - t0;
    shots = [
      { url: `data:image/jpeg;base64,${data.image}`, prompt: full, seed: data.seed ?? seed, ms: lastMs },
      ...shots,
    ].slice(0, 24);
    if (!lockSeed) seed = Math.floor(Math.random() * 1e6);
  }

  async function generate() {
    if (phase !== 'ready' || !prompt.trim()) return;
    phase = 'generating';
    error = '';
    if (mode === 'server') {
      try {
        await generateServer();
      } catch (e: any) {
        error = e?.message ?? String(e);
      }
      phase = 'ready';
      return;
    }
    const t0 = performance.now();
    try {
      const full = buildPrompt(preset, prompt);
      const sc = cfg.scheduler_config ?? {};
      const tStep = (sc.num_train_timesteps ?? 1000) - 1; // trailing spacing, 1 step
      const alphaT = Math.sqrt(alphasCumprod![tStep]);
      const sigmaT = Math.sqrt(1 - alphasCumprod![tStep]);

      // 1. text encoder
      const enc = await tokenizer(full, { padding: 'max_length', max_length: 77, truncation: true });
      const ids = Array.from(enc.input_ids.data as ArrayLike<number>, Number);
      const te = sessions.text_encoder!;
      const teName = te.inputNames[0];
      const idsTensor =
        ioType('text_encoder', teName) === 'int64'
          ? new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, 77])
          : new ort.Tensor('int32', Int32Array.from(ids), [1, 77]);
      const teOut = await te.run({ [teName]: idsTensor });
      const hName = te.outputNames.find((n: string) => /hidden|last/i.test(n)) ?? te.outputNames[0];
      const hidden = asF32(teOut[hName]);
      const hDims = teOut[hName].dims;

      // 2. one U-Net step. Latents have unit variance (DDPM), no input scaling.
      const ch = cfg.latent_channels ?? 4;
      const n = ch * LATENT * LATENT;
      const x = randn(n, seed);
      const un = sessions.unet!;
      const feeds: Record<string, any> = {};
      for (const nm of un.inputNames) {
        const ty = ioType('unet', nm);
        if (/encoder_hidden|hidden/i.test(nm)) feeds[nm] = mkTensor(ty, hidden, hDims);
        else if (/timestep|time/i.test(nm))
          feeds[nm] =
            ty === 'float32'
              ? new ort.Tensor('float32', new Float32Array([tStep]), [1])
              : new ort.Tensor('int64', BigInt64Array.from([BigInt(tStep)]), [1]);
        else feeds[nm] = mkTensor(ty, x, [1, ch, LATENT, LATENT]);
      }
      const eps = asF32((await un.run(feeds))[un.outputNames[0]]);

      // 3. x0 = (x − σₜ·ε) / αₜ
      const x0 = new Float32Array(n);
      for (let i = 0; i < n; i++) x0[i] = (x[i] - sigmaT * eps[i]) / alphaT;
      // AutoencoderTiny ships with scaling_factor 1.0 — dividing would wash it out.
      const sf = cfg.vae_scaling_factor ?? 1;
      if (sf !== 1) for (let i = 0; i < n; i++) x0[i] /= sf;

      // 4. decode
      const vd = sessions.vae_decoder!;
      const vIn = vd.inputNames[0];
      const img = asF32(
        (await vd.run({ [vIn]: mkTensor(ioType('vae_decoder', vIn), x0, [1, ch, LATENT, LATENT]) }))[
          vd.outputNames[0]
        ],
      );

      // 5. CHW in [-1,1] → canvas
      const size = MODEL.resolution;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const px = ctx.createImageData(size, size);
      const plane = size * size;
      for (let i = 0; i < plane; i++) {
        for (let c = 0; c < 3; c++) {
          px.data[i * 4 + c] = Math.max(0, Math.min(255, Math.round((img[c * plane + i] / 2 + 0.5) * 255)));
        }
        px.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(px, 0, 0);
      const url = canvas.toDataURL('image/png');

      lastMs = performance.now() - t0;
      shots = [{ url, prompt: full, seed, ms: lastMs }, ...shots].slice(0, 24);
      if (!lockSeed) seed = Math.floor(Math.random() * 1e6);
    } catch (e: any) {
      error = e?.message ?? String(e);
    }
    phase = 'ready';
  }

  function download(shot: Shot) {
    const a = document.createElement('a');
    a.href = shot.url;
    a.download = `vexyn-${shot.seed}.png`;
    a.click();
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
  }
</script>

<div class="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden">
  <!-- ── choose: no local GPU acceleration available ─────────────── -->
  {#if phase === 'choose'}
    <div class="p-6 sm:p-8">
      <div class="text-center mb-6">
        <div class="text-3xl mb-3">📱</div>
        <h2 class="text-lg font-semibold mb-2">Your device can't use GPU acceleration</h2>
        <p class="text-sm text-[color:var(--color-text-mute)] max-w-md mx-auto">{unsupportedReason}</p>
        <p class="text-sm text-[color:var(--color-text-mute)] max-w-md mx-auto mt-2">
          You can still generate — pick how:
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onclick={chooseServer}
          class="text-left p-4 rounded-lg border border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5 hover:bg-[color:var(--color-brand-500)]/10 transition"
        >
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-lg">⚡</span>
            <span class="font-semibold">Fast — on our server</span>
          </div>
          <p class="text-xs text-[color:var(--color-text-mute)] leading-relaxed mb-2">
            Images in ~4 seconds, nothing to download. Limited to a few per day because we pay for the
            GPU time.
          </p>
          <p class="text-xs text-[color:var(--color-accent-400)] leading-relaxed">
            Your prompt is sent to our server for this. It is used for the image and never stored.
          </p>
        </button>

        <button
          onclick={chooseWasm}
          class="text-left p-4 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-text-mute)] transition"
        >
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-lg">🔒</span>
            <span class="font-semibold">Unlimited — on your device</span>
          </div>
          <p class="text-xs text-[color:var(--color-text-mute)] leading-relaxed mb-2">
            No limit, prompts stay private. But it downloads {mb(880 * 1048576)} MB and each image takes
            roughly a minute on a phone CPU.
          </p>
          <p class="text-xs text-[color:var(--color-text-dim)] leading-relaxed">
            Best on Wi-Fi. Older phones may run out of memory.
          </p>
        </button>
      </div>
    </div>

  <!-- ── probe / idle ────────────────────────────────────────────── -->
  {:else if phase === 'probe' || phase === 'idle'}
    <div class="p-8 text-center">
      <div class="text-4xl mb-4">{preset.icon}</div>
      <h2 class="text-xl font-semibold mb-2">Load the model once, then generate forever</h2>
      <p class="text-sm text-[color:var(--color-text-mute)] max-w-lg mx-auto mb-1">
        About {mb(880 * 1048576)} MB downloads to your browser and stays cached. After that every image is
        generated {mode === 'wasm' ? 'on your CPU — around a minute each' : `on ${gpuName || 'your GPU'} in a couple of seconds`} — no account, no queue, no limit.
      </p>
      <p class="text-xs text-[color:var(--color-text-dim)] mb-6">
        Your prompts are never sent anywhere. Open DevTools → Network and check.
      </p>
      <button
        onclick={load}
        disabled={phase === 'probe'}
        class="px-6 py-3 rounded-lg bg-[color:var(--color-brand-500)] text-white font-semibold hover:brightness-110 transition disabled:opacity-40"
      >
        {phase === 'probe' ? 'Checking your GPU…' : 'Load model'}
      </button>
      {#if mode === 'wasm'}
        <p class="mt-3 text-xs text-[color:var(--color-text-dim)]">
          <button onclick={chooseServer} class="underline hover:text-[color:var(--color-text-mute)]">
            Changed your mind? Use the fast server option instead
          </button>
        </p>
      {/if}
      {#if error}
        <p class="mt-4 text-sm text-red-400">{error}</p>
      {/if}
    </div>

  <!-- ── loading ─────────────────────────────────────────────────── -->
  {:else if phase === 'loading'}
    <div class="p-8">
      <div class="flex items-baseline justify-between mb-2">
        <span class="text-sm font-medium">{loadingLabel}</span>
        <span class="text-sm tabular-nums text-[color:var(--color-text-mute)]">
          {mb(bytesDone)} / {mb(bytesTotal)} MB
        </span>
      </div>
      <div class="h-2 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
        <div
          class="h-full bg-[color:var(--color-brand-500)] transition-[width] duration-200"
          style={`width:${pct}%`}
        ></div>
      </div>
      <div class="flex justify-between mt-2 text-xs text-[color:var(--color-text-dim)]">
        <span>{mbps ? `${mbps.toFixed(1)} MB/s` : 'starting…'}</span>
        <span>{etaSec ? `~${etaSec}s left` : 'almost there'}</span>
      </div>
      <p class="mt-6 text-xs text-[color:var(--color-text-mute)] leading-relaxed">
        This happens once. The browser caches the model, so your next visit skips straight to generating.
        Preparing each part briefly freezes the tab — that is the GPU compiling shaders, and it cannot be
        moved off the main thread.
      </p>
    </div>

  <!-- ── ready / generating ──────────────────────────────────────── -->
  {:else}
    <div class="p-5 sm:p-6">
      {#if mode !== 'webgpu'}
        <div class="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[color:var(--color-bg)] border border-[color:var(--color-border)] text-xs">
          {#if mode === 'server'}
            <span>⚡</span>
            <span class="text-[color:var(--color-text-mute)]">
              Generating on our server — prompts leave your device.
              {#if serverRemaining !== null}<span class="text-[color:var(--color-text)]">{serverRemaining} left today.</span>{/if}
            </span>
            <button
              onclick={chooseWasm}
              class="ml-auto shrink-0 underline text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
            >
              Switch to private
            </button>
          {:else}
            <span>🔒</span>
            <span class="text-[color:var(--color-text-mute)]">
              Running on your CPU — private and unlimited, but slow.
            </span>
          {/if}
        </div>
      {/if}

      <label for="vexyn-prompt" class="sr-only">Prompt</label>
      <textarea
        id="vexyn-prompt"
        bind:value={prompt}
        onkeydown={onKey}
        rows="2"
        placeholder={preset.placeholder}
        class="w-full resize-none rounded-lg bg-[color:var(--color-bg)] border border-[color:var(--color-border)] px-4 py-3 text-[15px] outline-none focus:border-[color:var(--color-brand-500)] transition"
      ></textarea>

      <div class="flex flex-wrap items-center gap-2 mt-3">
        <button
          onclick={generate}
          disabled={phase === 'generating' || !prompt.trim()}
          class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] text-white font-semibold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {phase === 'generating' ? 'Generating…' : 'Generate'}
        </button>
        <span class="text-xs text-[color:var(--color-text-dim)] hidden sm:inline">⌘/Ctrl + Enter</span>

        <div class="ml-auto flex items-center gap-2">
          <label class="flex items-center gap-1.5 text-xs text-[color:var(--color-text-mute)] cursor-pointer">
            <input type="checkbox" bind:checked={lockSeed} class="accent-[color:var(--color-brand-500)]" />
            Lock seed
          </label>
          <input
            type="number"
            bind:value={seed}
            aria-label="Seed"
            class="w-24 rounded-md bg-[color:var(--color-bg)] border border-[color:var(--color-border)] px-2 py-1 text-xs tabular-nums outline-none focus:border-[color:var(--color-brand-500)]"
          />
        </div>
      </div>

      {#if !shots.length}
        <div class="mt-4">
          <p class="text-xs text-[color:var(--color-text-dim)] mb-2">Try one of these:</p>
          <div class="flex flex-wrap gap-2">
            {#each preset.examples as ex}
              <button
                onclick={() => (prompt = ex)}
                class="px-3 py-1.5 rounded-full text-xs border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:border-[color:var(--color-brand-500)] hover:text-[color:var(--color-text)] transition"
              >
                {ex}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if error}
        <p class="mt-4 text-sm text-red-400">{error}</p>
      {/if}

      {#if shots.length}
        <p class="mt-5 mb-2 text-xs text-[color:var(--color-text-dim)]">
          {shots.length} image{shots.length > 1 ? 's' : ''} · last one took {(lastMs / 1000).toFixed(1)}s
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {#each shots as shot (shot.url)}
            <figure class="group relative rounded-lg overflow-hidden border border-[color:var(--color-border)]">
              <img src={shot.url} alt={shot.prompt} width="512" height="512" class="w-full aspect-square object-cover" />
              <figcaption
                class="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition"
              >
                <button
                  onclick={() => download(shot)}
                  class="w-full text-xs font-medium text-white py-1 rounded bg-white/15 hover:bg-white/25 backdrop-blur transition"
                >
                  Download PNG
                </button>
              </figcaption>
            </figure>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
