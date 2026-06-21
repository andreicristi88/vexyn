<script lang="ts">
  import { onMount } from 'svelte';

  type Status = 'idle' | 'loading-model' | 'ready' | 'decoding' | 'transcribing' | 'done' | 'error';
  type ModelSize = 'tiny' | 'base';
  type Chunk = { timestamp: [number, number | null]; text: string };

  const MODELS: Record<ModelSize, { id: string; size: string; label: string }> = {
    tiny: { id: 'Xenova/whisper-tiny', size: '~75 MB', label: 'Tiny (fast)' },
    base: { id: 'Xenova/whisper-base', size: '~145 MB', label: 'Base (better)' },
  };

  const LANGUAGES = [
    { code: 'auto', name: 'Auto-detect' },
    { code: 'en', name: 'English' },
    { code: 'ro', name: 'Romanian' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'ru', name: 'Russian' },
    { code: 'tr', name: 'Turkish' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ko', name: 'Korean' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'cs', name: 'Czech' },
    { code: 'hu', name: 'Hungarian' },
  ];

  let lib: any = $state(null);
  let transcriber: any = $state(null);
  let device: 'webgpu' | 'wasm' = $state('wasm');
  let status: Status = $state('idle');
  let modelSize: ModelSize = $state('tiny');
  let loadProgress = $state(0);
  let loadLabel = $state('');
  let transcribeProgress = $state(0);
  let language = $state('auto');
  let task: 'transcribe' | 'translate' = $state('transcribe');
  let errorMsg = $state('');

  let audioName = $state('');
  let audioDuration = $state(0);
  let audioUrl = $state('');
  let audioSamples: Float32Array | null = null;

  let transcript = $state('');
  let chunks = $state<Chunk[]>([]);
  let showTimestamps = $state(true);
  let copied = $state(false);
  let dragOver = $state(false);
  let fileInput: HTMLInputElement;

  onMount(async () => {
    if (typeof window === 'undefined') return;
    try {
      lib = await import('@huggingface/transformers');
      lib.env.allowLocalModels = false;
      lib.env.useBrowserCache = true;
      device = (navigator as any).gpu && (await tryWebGPU()) ? 'webgpu' : 'wasm';
      status = 'ready';
    } catch (e: any) {
      console.error('[Whisper] init failed', e);
      errorMsg = e?.message || 'Failed to load the engine.';
      status = 'error';
    }
  });

  async function tryWebGPU(): Promise<boolean> {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  async function loadModel() {
    if (!lib || transcriber) return;
    status = 'loading-model';
    loadProgress = 0;
    loadLabel = '';
    try {
      transcriber = await lib.pipeline(
        'automatic-speech-recognition',
        MODELS[modelSize].id,
        {
          device,
          dtype: device === 'webgpu' ? 'fp32' : 'q8',
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
        },
      );
      status = 'ready';
    } catch (e: any) {
      console.error('[Whisper] model load failed', e);
      errorMsg = e?.message || 'Failed to load the model.';
      status = 'error';
    }
  }

  async function decodeAudio(file: File): Promise<Float32Array> {
    const arrayBuffer = await file.arrayBuffer();
    const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    tempCtx.close();

    audioDuration = audioBuffer.duration;

    // Resample to 16kHz mono via OfflineAudioContext
    const targetSampleRate = 16000;
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate,
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const resampled = await offlineCtx.startRendering();
    return resampled.getChannelData(0);
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|flac|aac|opus|webm)$/i.test(file.name)) {
      errorMsg = 'Please drop an audio file (MP3, WAV, M4A, OGG, FLAC, AAC).';
      return;
    }
    errorMsg = '';
    transcript = '';
    chunks = [];
    audioName = file.name;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(file);
    status = 'decoding';
    try {
      audioSamples = await decodeAudio(file);
    } catch (e: any) {
      console.error('[Whisper] decode failed', e);
      errorMsg = 'Could not decode audio file. Try a different format.';
      status = 'error';
      return;
    }
    status = 'ready';
    if (!transcriber) {
      await loadModel();
    }
    if (status === 'ready') {
      await transcribe();
    }
  }

  async function transcribe() {
    if (!transcriber || !audioSamples) return;
    status = 'transcribing';
    transcribeProgress = 5;
    errorMsg = '';
    transcript = '';
    chunks = [];

    const totalSamples = audioSamples.length;
    let lastUpdate = 0;

    try {
      const result = await transcriber(audioSamples, {
        language: language === 'auto' ? undefined : language,
        task,
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
        callback_function: (beam: any) => {
          // Streams partial decoded output — update progress + text on the fly
          if (beam?.[0]?.output_token_ids) {
            const text = transcriber.tokenizer.decode(beam[0].output_token_ids, {
              skip_special_tokens: true,
            });
            transcript = text;
          }
          // Best-effort progress bump
          const now = performance.now();
          if (now - lastUpdate > 200) {
            transcribeProgress = Math.min(95, transcribeProgress + 1);
            lastUpdate = now;
          }
        },
        chunk_callback: (chunk: any) => {
          if (chunk?.timestamp) {
            chunks = [...chunks, { timestamp: chunk.timestamp, text: chunk.text ?? '' }];
            transcribeProgress = Math.min(
              95,
              Math.round(((chunk.timestamp[1] ?? audioDuration) / audioDuration) * 95),
            );
          }
        },
      });

      transcript = (result?.text ?? '').trim();
      if (result?.chunks?.length) {
        chunks = result.chunks.map((c: any) => ({
          timestamp: c.timestamp,
          text: (c.text ?? '').trim(),
        }));
      }
      transcribeProgress = 100;
      status = 'done';
    } catch (e: any) {
      console.error('[Whisper] transcribe failed', e);
      errorMsg = e?.message || 'Transcription failed.';
      status = 'error';
    }
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

  function copy() {
    if (!transcript) return;
    navigator.clipboard.writeText(formatOutput());
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  function formatOutput(): string {
    if (!showTimestamps || chunks.length === 0) return transcript;
    return chunks
      .map((c) => `[${fmtTime(c.timestamp[0])} - ${fmtTime(c.timestamp[1] ?? audioDuration)}]  ${c.text}`)
      .join('\n');
  }

  function downloadText() {
    download(formatOutput(), `${baseName(audioName)}.txt`, 'text/plain');
  }

  function downloadSrt() {
    if (chunks.length === 0) {
      download(transcript, `${baseName(audioName)}.txt`, 'text/plain');
      return;
    }
    const srt = chunks
      .map((c, i) => {
        const start = fmtSrt(c.timestamp[0]);
        const end = fmtSrt(c.timestamp[1] ?? audioDuration);
        return `${i + 1}\n${start} --> ${end}\n${c.text}\n`;
      })
      .join('\n');
    download(srt, `${baseName(audioName)}.srt`, 'application/x-subrip');
  }

  function downloadVtt() {
    if (chunks.length === 0) {
      download(transcript, `${baseName(audioName)}.txt`, 'text/plain');
      return;
    }
    const vtt =
      'WEBVTT\n\n' +
      chunks
        .map((c) => {
          const start = fmtVtt(c.timestamp[0]);
          const end = fmtVtt(c.timestamp[1] ?? audioDuration);
          return `${start} --> ${end}\n${c.text}\n`;
        })
        .join('\n');
    download(vtt, `${baseName(audioName)}.vtt`, 'text/vtt');
  }

  function download(text: string, filename: string, mime: string) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function baseName(n: string): string {
    const dot = n.lastIndexOf('.');
    return dot > 0 ? n.slice(0, dot) : n || 'transcript';
  }

  function fmtTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  function fmtSrt(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s - Math.floor(s)) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(sec)},${String(ms).padStart(3, '0')}`;
  }
  function fmtVtt(s: number): string {
    return fmtSrt(s).replace(',', '.');
  }
  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  function reset() {
    transcript = '';
    chunks = [];
    audioName = '';
    audioDuration = 0;
    audioSamples = null;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = '';
    }
    transcribeProgress = 0;
    errorMsg = '';
    status = transcriber ? 'ready' : 'idle';
  }

  async function changeModel(newSize: ModelSize) {
    if (newSize === modelSize) return;
    modelSize = newSize;
    transcriber = null;
    if (audioSamples) {
      await loadModel();
      if (status === 'ready') await transcribe();
    }
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
      <span class="text-[color:var(--color-text-mute)] truncate">Loading {MODELS[modelSize].label}… <span class="font-mono text-xs">{loadLabel}</span></span>
    {:else if status === 'decoding'}
      <span class="text-[color:var(--color-text-mute)]">Decoding audio…</span>
    {:else if status === 'ready'}
      <span class="text-[color:var(--color-text)]">Ready</span>
    {:else if status === 'transcribing'}
      <span class="text-[color:var(--color-text)]">Transcribing… {transcribeProgress}%</span>
    {:else if status === 'done'}
      <span class="text-[color:var(--color-text)]">Done</span>
    {:else if status === 'error'}
      <span class="text-[color:var(--color-danger)] truncate">{errorMsg}</span>
    {/if}
  </div>

  <div class="flex items-center gap-2 flex-shrink-0">
    <div class="flex p-0.5 rounded-md bg-[color:var(--color-bg)] border border-[color:var(--color-border)]" title="Tiny ~75 MB, Base ~145 MB (more accurate)">
      <button
        type="button"
        onclick={() => changeModel('tiny')}
        disabled={status === 'loading-model' || status === 'transcribing'}
        class={[
          'px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50',
          modelSize === 'tiny' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
        ]}
      >Tiny</button>
      <button
        type="button"
        onclick={() => changeModel('base')}
        disabled={status === 'loading-model' || status === 'transcribing'}
        class={[
          'px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50',
          modelSize === 'base' ? 'bg-[color:var(--color-brand-500)] text-white' : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
        ]}
      >Base</button>
    </div>
    <div class="text-[10px] text-[color:var(--color-text-dim)] font-mono uppercase tracking-wider">
      {device}{#if device === 'wasm'} <span class="text-[color:var(--color-warning)]">(slow)</span>{/if}
    </div>
  </div>
</div>

<!-- Language + task -->
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
  <div>
    <label for="lang" class="block text-xs font-medium text-[color:var(--color-text-mute)] mb-1 uppercase tracking-wider">Language</label>
    <select
      id="lang"
      bind:value={language}
      disabled={status === 'transcribing'}
      class="w-full p-2 rounded bg-[color:var(--color-bg)] border border-[color:var(--color-border)] text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-brand-500)] focus:outline-none disabled:opacity-50"
    >
      {#each LANGUAGES as l}
        <option value={l.code}>{l.name}</option>
      {/each}
    </select>
  </div>
  <div>
    <label for="task" class="block text-xs font-medium text-[color:var(--color-text-mute)] mb-1 uppercase tracking-wider">Mode</label>
    <select
      id="task"
      bind:value={task}
      disabled={status === 'transcribing'}
      class="w-full p-2 rounded bg-[color:var(--color-bg)] border border-[color:var(--color-border)] text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-brand-500)] focus:outline-none disabled:opacity-50"
    >
      <option value="transcribe">Transcribe (keep language)</option>
      <option value="translate">Translate to English</option>
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
  disabled={status === 'loading-model' || status === 'decoding' || status === 'transcribing'}
  class={[
    'w-full p-10 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3',
    (status === 'loading-model' || status === 'decoding' || status === 'transcribing') ? 'cursor-wait opacity-60' : 'cursor-pointer',
    dragOver
      ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5'
      : 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-500)]/5'
  ]}
>
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[color:var(--color-text-mute)]">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
  <div class="text-center">
    <p class="font-medium text-[color:var(--color-text)]">
      {dragOver ? 'Drop your audio' : 'Drop an audio file here or click to browse'}
    </p>
    <p class="text-xs text-[color:var(--color-text-mute)] mt-1">
      MP3, WAV, M4A, OGG, FLAC, AAC, OPUS. Runs on your device — audio never uploaded.
    </p>
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.opus,.webm"
    onchange={onPick}
    class="hidden"
  />
</button>

{#if status === 'loading-model'}
  <div class="mt-4 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
    <div class="flex justify-between text-xs text-[color:var(--color-text-mute)] mb-1.5">
      <span>First-time model download ({MODELS[modelSize].size}, then cached)</span>
      <span class="font-mono">{loadProgress}%</span>
    </div>
    <div class="h-1.5 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
      <div class="h-full bg-[color:var(--color-brand-500)] transition-all" style:width={`${loadProgress}%`}></div>
    </div>
  </div>
{/if}

{#if audioName}
  <div class="mt-6 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] flex items-center gap-3">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[color:var(--color-brand-400)] flex-shrink-0">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium truncate">{audioName}</p>
      {#if audioDuration}
        <p class="text-xs text-[color:var(--color-text-mute)] font-mono">{fmtTime(audioDuration)}</p>
      {/if}
    </div>
    {#if audioUrl}
      <audio src={audioUrl} controls class="hidden sm:block max-w-xs"></audio>
    {/if}
    <button
      onclick={reset}
      aria-label="Remove audio"
      class="w-9 h-9 rounded hover:bg-[color:var(--color-danger)]/10 text-[color:var(--color-text-mute)] hover:text-[color:var(--color-danger)] flex items-center justify-center flex-shrink-0"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
{/if}

{#if status === 'transcribing'}
  <div class="mt-4 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
    <div class="flex justify-between text-xs text-[color:var(--color-text-mute)] mb-1.5">
      <span>Transcribing on {device.toUpperCase()}</span>
      <span class="font-mono">{transcribeProgress}%</span>
    </div>
    <div class="h-1.5 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
      <div class="h-full bg-[color:var(--color-brand-500)] transition-all" style:width={`${transcribeProgress}%`}></div>
    </div>
  </div>
{/if}

{#if transcript || chunks.length > 0}
  <div class="mt-6">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <h3 class="text-sm font-semibold text-[color:var(--color-text-mute)] uppercase tracking-wider">Transcript</h3>
      <div class="flex flex-wrap gap-2">
        <label class="text-xs flex items-center gap-1.5 cursor-pointer text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]">
          <input type="checkbox" bind:checked={showTimestamps} class="accent-[color:var(--color-brand-500)]" />
          Timestamps
        </label>
        <button
          onclick={copy}
          class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <button
          onclick={downloadText}
          class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]"
        >TXT</button>
        <button
          onclick={downloadSrt}
          class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]"
        >SRT</button>
        <button
          onclick={downloadVtt}
          class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]"
        >VTT</button>
      </div>
    </div>

    {#if showTimestamps && chunks.length > 0}
      <div class="rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 max-h-[60vh] overflow-y-auto space-y-2 text-sm leading-relaxed">
        {#each chunks as c}
          <div class="flex gap-3">
            <span class="text-[color:var(--color-text-dim)] font-mono text-xs whitespace-nowrap pt-0.5">
              {fmtTime(c.timestamp[0])} - {fmtTime(c.timestamp[1] ?? audioDuration)}
            </span>
            <span class="text-[color:var(--color-text)]">{c.text}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 max-h-[60vh] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-text)]">
        {transcript}
      </div>
    {/if}
  </div>
{/if}
