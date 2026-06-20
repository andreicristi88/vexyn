<script lang="ts">
  let mode = $state<'encode' | 'decode'>('encode');
  let input = $state('');
  let output = $state('');
  let error = $state('');
  let copied = $state(false);

  function encode(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  function decode(b64: string): string {
    const binary = atob(b64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  function process() {
    error = '';
    if (!input) {
      output = '';
      return;
    }
    try {
      output = mode === 'encode' ? encode(input) : decode(input);
    } catch (e: any) {
      error = mode === 'encode' ? 'Encoding failed.' : 'Invalid Base64 string.';
      output = '';
    }
  }

  $effect(() => {
    void input;
    void mode;
    process();
  });

  function copy() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    copied = true;
    setTimeout(() => copied = false, 1500);
  }

  function swap() {
    const oldOutput = output;
    mode = mode === 'encode' ? 'decode' : 'encode';
    input = oldOutput;
  }
</script>

<!-- Mode switch -->
<div class="inline-flex p-1 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] mb-4">
  <button
    onclick={() => mode = 'encode'}
    class:list={[
      'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
      mode === 'encode'
        ? 'bg-[color:var(--color-brand-500)] text-white'
        : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
    ]}
  >
    Encode
  </button>
  <button
    onclick={() => mode = 'decode'}
    class:list={[
      'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
      mode === 'decode'
        ? 'bg-[color:var(--color-brand-500)] text-white'
        : 'text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]'
    ]}
  >
    Decode
  </button>
</div>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <div class="flex flex-col">
    <label for="b64-input" class="text-sm font-medium text-[color:var(--color-text-mute)] mb-2">
      {mode === 'encode' ? 'Plain text' : 'Base64 string'}
    </label>
    <textarea
      id="b64-input"
      bind:value={input}
      placeholder={mode === 'encode' ? 'Type or paste text to encode...' : 'Paste Base64 to decode...'}
      spellcheck="false"
      class="w-full h-72 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] font-mono text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-dim)] resize-none focus:border-[color:var(--color-brand-500)] focus:outline-none transition-colors"
    ></textarea>
  </div>

  <div class="flex flex-col">
    <div class="flex items-center justify-between mb-2">
      <label for="b64-output" class="text-sm font-medium text-[color:var(--color-text-mute)]">
        {mode === 'encode' ? 'Base64 output' : 'Decoded text'}
      </label>
      <button
        onclick={copy}
        disabled={!output}
        class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
    <textarea
      id="b64-output"
      value={output}
      readonly
      placeholder="Result will appear here..."
      spellcheck="false"
      class="w-full h-72 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] font-mono text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-dim)] resize-none focus:outline-none break-all"
    ></textarea>
  </div>
</div>

<div class="mt-4 flex items-center gap-3">
  <button
    onclick={swap}
    disabled={!output}
    class="px-4 py-2 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
    Swap input/output
  </button>
</div>

{#if error}
  <div class="mt-4 p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">
    {error}
  </div>
{/if}
