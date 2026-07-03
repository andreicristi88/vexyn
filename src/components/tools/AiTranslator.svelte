<script lang="ts">
  import { onMount } from 'svelte';

  type Status = 'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error';

  const MODEL_ID = 'Xenova/nllb-200-distilled-600M';

  // Popular languages from NLLB-200 — full list has 200+ but this covers ~95% of use cases.
  const LANGS: Array<{ code: string; name: string }> = [
    { code: 'eng_Latn', name: 'English' },
    { code: 'ron_Latn', name: 'Romanian' },
    { code: 'fra_Latn', name: 'French' },
    { code: 'spa_Latn', name: 'Spanish' },
    { code: 'deu_Latn', name: 'German' },
    { code: 'ita_Latn', name: 'Italian' },
    { code: 'por_Latn', name: 'Portuguese' },
    { code: 'nld_Latn', name: 'Dutch' },
    { code: 'pol_Latn', name: 'Polish' },
    { code: 'rus_Cyrl', name: 'Russian' },
    { code: 'ukr_Cyrl', name: 'Ukrainian' },
    { code: 'bul_Cyrl', name: 'Bulgarian' },
    { code: 'hun_Latn', name: 'Hungarian' },
    { code: 'ces_Latn', name: 'Czech' },
    { code: 'slk_Latn', name: 'Slovak' },
    { code: 'ell_Grek', name: 'Greek' },
    { code: 'tur_Latn', name: 'Turkish' },
    { code: 'arb_Arab', name: 'Arabic' },
    { code: 'heb_Hebr', name: 'Hebrew' },
    { code: 'zho_Hans', name: 'Chinese (Simplified)' },
    { code: 'zho_Hant', name: 'Chinese (Traditional)' },
    { code: 'jpn_Jpan', name: 'Japanese' },
    { code: 'kor_Hang', name: 'Korean' },
    { code: 'hin_Deva', name: 'Hindi' },
    { code: 'ben_Beng', name: 'Bengali' },
    { code: 'ind_Latn', name: 'Indonesian' },
    { code: 'vie_Latn', name: 'Vietnamese' },
    { code: 'tha_Thai', name: 'Thai' },
    { code: 'swe_Latn', name: 'Swedish' },
    { code: 'nob_Latn', name: 'Norwegian' },
    { code: 'dan_Latn', name: 'Danish' },
    { code: 'fin_Latn', name: 'Finnish' },
  ];

  let lib: any = $state(null);
  let translator: any = $state(null);
  let status: Status = $state('idle');
  let loadProgress = $state(0);
  let loadLabel = $state('');
  let device: 'webgpu' | 'wasm' = $state('wasm');
  let errorMsg = $state('');

  let source = $state('eng_Latn');
  let target = $state('ron_Latn');
  let inputText = $state('');
  let outputText = $state('');
  let elapsedSec = $state(0);
  let copied = $state(false);

  onMount(async () => {
    try {
      lib = await import('@huggingface/transformers');
      status = 'loading';
      const supportsWebGPU = 'gpu' in navigator;
      device = supportsWebGPU ? 'webgpu' : 'wasm';
      loadLabel = 'Downloading translation model (~400 MB)…';
      translator = await lib.pipeline('translation', MODEL_ID, {
        device,
        dtype: 'q8',
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
      console.error('[Translator] init failed', e);
    }
  });

  function swap() {
    [source, target] = [target, source];
    [inputText, outputText] = [outputText, inputText];
  }

  async function translate() {
    if (!translator || !inputText.trim()) return;
    status = 'processing';
    errorMsg = '';
    outputText = '';
    const start = performance.now();
    try {
      // NLLB has ~200 token context — split long texts into chunks by sentence.
      const chunks = inputText.match(/[^.!?\n]+[.!?]?(\s|$)/g) ?? [inputText];
      const results: string[] = [];
      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;
        const out = await translator(trimmed, { src_lang: source, tgt_lang: target });
        results.push(out[0].translation_text);
      }
      outputText = results.join(' ');
      elapsedSec = Math.round((performance.now() - start) / 100) / 10;
      status = 'done';
    } catch (e: any) {
      status = 'error';
      errorMsg = `Translation failed: ${e?.message ?? e}`;
      console.error('[Translator] failed', e);
    }
  }

  async function copyOutput() {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {}
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
      <p class="text-xs text-[color:var(--color-text-mute)] mt-2">NLLB-200 supports 200 languages. Model is ~400 MB quantised — one-time download, cached forever.</p>
    </div>
  {/if}

  {#if status !== 'idle' && status !== 'loading'}
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-3">
      <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <select bind:value={source} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
          {#each LANGS as l}<option value={l.code}>{l.name}</option>{/each}
        </select>
        <button class="p-2 rounded-lg hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={swap} title="Swap languages" aria-label="Swap source and target languages">⇄</button>
        <select bind:value={target} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
          {#each LANGS as l}<option value={l.code}>{l.name}</option>{/each}
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
        <label class="block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-dim)] mb-2">Source</label>
        <textarea bind:value={inputText} placeholder="Type or paste text here…" class="w-full h-48 px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] resize-none text-sm" maxlength="5000"></textarea>
        <p class="text-xs text-[color:var(--color-text-mute)] mt-2">{inputText.length} / 5000 chars</p>
      </div>
      <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-dim)]">Translation</label>
          {#if outputText}
            <button class="text-xs px-2 py-1 rounded bg-[color:var(--color-surface-2)] hover:bg-[color:var(--color-surface)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={copyOutput}>{copied ? 'Copied!' : 'Copy'}</button>
          {/if}
        </div>
        <textarea value={outputText} readonly placeholder="Translation appears here…" class="w-full h-48 px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] resize-none text-sm"></textarea>
        {#if elapsedSec > 0}
          <p class="text-xs text-[color:var(--color-text-mute)] mt-2">Translated in {elapsedSec}s on {device === 'webgpu' ? 'GPU' : 'CPU'}.</p>
        {/if}
      </div>
    </div>

    <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={translate} disabled={status === 'processing' || !inputText.trim()}>
      {status === 'processing' ? 'Translating…' : 'Translate'}
    </button>
    {#if status === 'processing'}
      <p class="text-xs text-[color:var(--color-text-mute)] text-center">Long texts get split into sentences and translated in sequence.</p>
    {/if}
  {/if}

  {#if errorMsg}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{errorMsg}</div>
  {/if}
</div>
