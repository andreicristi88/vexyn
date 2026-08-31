<script lang="ts">
  import { parseCsv, gridToRecords, delimiterLabel, type Grid } from '../../lib/csv';

  let fileName = $state('');
  let hasHeader = $state(true);
  let grid = $state<Grid | null>(null);
  let error = $state('');
  let dragOver = $state(false);
  let copied = $state(false);

  let shape = $state<'objects' | 'arrays'>('objects');
  let pretty = $state(true);

  let fileInput: HTMLInputElement;
  let pasteText = $state('');

  const json = $derived.by(() => {
    if (!grid) return '';
    const value =
      shape === 'objects'
        ? gridToRecords(grid)
        : [grid.headers, ...grid.rows];
    return JSON.stringify(value, null, pretty ? 2 : 0);
  });

  function loadText(text: string, name: string) {
    error = ''; copied = false;
    const res = parseCsv(text, hasHeader);
    if (!res.ok) { error = res.error; grid = null; return; }
    grid = res.grid; fileName = name;
  }
  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) { error = 'File is larger than 50 MB. Split it first.'; return; }
    loadText(await f.text(), f.name);
  }
  function onPick(e: Event) { const t = e.target as HTMLInputElement; if (t.files?.[0]) handleFile(t.files[0]); t.value = ''; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function loadPaste() { if (pasteText.trim()) loadText(pasteText, 'pasted.csv'); }
  function reparse() { if (fileName === 'pasted.csv' && pasteText.trim()) loadText(pasteText, 'pasted.csv'); }

  function download() {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (fileName.replace(/\.[^.]+$/, '') || 'data') + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyJson() {
    try { await navigator.clipboard.writeText(json); copied = true; setTimeout(() => (copied = false), 1500); } catch {}
  }
  function reset() { grid = null; fileName = ''; pasteText = ''; error = ''; }
</script>

<div class="space-y-4">
  {#if !grid}
    <div class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
      on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="CSV drop zone">
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a CSV or TSV file here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors" on:click={() => fileInput.click()}>Choose file</button>
      <input bind:this={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv" class="hidden" on:change={onPick} />
    </div>
    <details class="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <summary class="px-4 py-3 text-sm font-medium cursor-pointer select-none">…or paste CSV text</summary>
      <div class="px-4 pb-4 space-y-2">
        <textarea bind:value={pasteText} placeholder="name,amount&#10;ACME,120" class="w-full h-32 px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm font-mono resize-none"></textarea>
        <button class="px-4 py-2 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white text-sm font-medium disabled:opacity-50" on:click={loadPaste} disabled={!pasteText.trim()}>Load pasted text</button>
      </div>
    </details>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}

  {#if grid}
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <div class="text-sm">
        <p class="font-medium text-[color:var(--color-text)]">{fileName}</p>
        <p class="text-xs text-[color:var(--color-text-mute)]">{delimiterLabel(grid.delimiter)}-delimited · {grid.headers.length} columns · {grid.rows.length} rows</p>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-[color:var(--color-text-mute)]"><input type="checkbox" bind:checked={hasHeader} on:change={reparse} class="rounded" />First row is a header</label>
        <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] px-2 py-1" on:click={reset}>Change file</button>
      </div>
    </div>

    <div class="flex flex-wrap gap-4 p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <label class="text-sm">
        <span class="font-semibold block mb-1">Shape</span>
        <select bind:value={shape} class="px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm">
          <option value="objects">Array of objects</option>
          <option value="arrays">Array of arrays</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-sm mt-6"><input type="checkbox" bind:checked={pretty} class="rounded" />Pretty-print</label>
    </div>

    <div class="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
      <pre class="overflow-auto max-h-[400px] p-4 text-xs font-mono text-[color:var(--color-text-mute)] bg-[color:var(--color-surface)]"><code>{json.length > 20000 ? json.slice(0, 20000) + '\n… (truncated in preview; the download has everything)' : json}</code></pre>
    </div>

    <div class="flex flex-wrap gap-2">
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2" on:click={download}>
        Download JSON
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="px-4 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] text-sm font-medium" on:click={copyJson}>{copied ? 'Copied!' : 'Copy'}</button>
    </div>
  {/if}
</div>
