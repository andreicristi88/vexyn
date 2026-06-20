<script lang="ts">
  let input = $state('');
  let output = $state('');
  let error = $state('');
  let indent = $state(2);
  let copied = $state(false);

  function format() {
    error = '';
    if (!input.trim()) {
      output = '';
      return;
    }
    try {
      const parsed = JSON.parse(input);
      output = JSON.stringify(parsed, null, indent);
    } catch (e: any) {
      error = e.message;
      output = '';
    }
  }

  function minify() {
    error = '';
    if (!input.trim()) {
      output = '';
      return;
    }
    try {
      const parsed = JSON.parse(input);
      output = JSON.stringify(parsed);
    } catch (e: any) {
      error = e.message;
      output = '';
    }
  }

  function copy() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    copied = true;
    setTimeout(() => copied = false, 1500);
  }

  function clearAll() {
    input = '';
    output = '';
    error = '';
  }

  function loadSample() {
    input = '{"name":"Vexyn","tagline":"Tools that stay on your device","tools":[{"slug":"json-formatter","available":true},{"slug":"base64","available":true}],"stats":{"local":true,"uploads":0}}';
    format();
  }
</script>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <!-- Input -->
  <div class="flex flex-col">
    <div class="flex items-center justify-between mb-2">
      <label for="json-input" class="text-sm font-medium text-[color:var(--color-text-mute)]">Input</label>
      <div class="flex gap-2">
        <button onclick={loadSample} class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]">Sample</button>
        <button onclick={clearAll} class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]">Clear</button>
      </div>
    </div>
    <textarea
      id="json-input"
      bind:value={input}
      placeholder={'Paste your JSON here...\n\n{ "hello": "world" }'}
      spellcheck="false"
      class="w-full h-96 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] font-mono text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-dim)] resize-none focus:border-[color:var(--color-brand-500)] focus:outline-none transition-colors"
    ></textarea>
  </div>

  <!-- Output -->
  <div class="flex flex-col">
    <div class="flex items-center justify-between mb-2">
      <label for="json-output" class="text-sm font-medium text-[color:var(--color-text-mute)]">Output</label>
      <button
        onclick={copy}
        disabled={!output}
        class="text-xs px-2 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
    <textarea
      id="json-output"
      value={output}
      readonly
      placeholder="Formatted JSON will appear here..."
      spellcheck="false"
      class="w-full h-96 p-4 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] font-mono text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-dim)] resize-none focus:outline-none"
    ></textarea>
  </div>
</div>

<!-- Controls -->
<div class="mt-4 flex flex-wrap items-center gap-3">
  <button
    onclick={format}
    class="px-4 py-2 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors"
  >
    Format
  </button>
  <button
    onclick={minify}
    class="px-4 py-2 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] font-medium transition-colors"
  >
    Minify
  </button>
  <div class="flex items-center gap-2 ml-auto">
    <label for="indent" class="text-sm text-[color:var(--color-text-mute)]">Indent:</label>
    <select
      id="indent"
      bind:value={indent}
      class="px-2 py-1 rounded bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-brand-500)] focus:outline-none"
    >
      <option value={2}>2 spaces</option>
      <option value={4}>4 spaces</option>
      <option value={'\t'}>Tab</option>
    </select>
  </div>
</div>

{#if error}
  <div class="mt-4 p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)] font-mono">
    <strong>Error:</strong> {error}
  </div>
{/if}
