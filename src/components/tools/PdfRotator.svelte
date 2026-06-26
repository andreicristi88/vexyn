<script lang="ts">
  import { onMount } from 'svelte';

  let PDFLib: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let pageCount = $state(0);
  let rotation = $state<90 | 180 | 270>(90);
  let scope = $state<'all' | 'range'>('all');
  let rangeStr = $state('1');
  let working = $state(false);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('rotated.pdf');
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      PDFLib = await import('pdf-lib');
      ready = true;
    } catch (e: any) {
      error = `Could not load PDF engine: ${e?.message ?? e}`;
    }
  });

  async function pickFile(f: File) {
    revoke();
    error = '';
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) {
      error = 'Drop a PDF (.pdf).';
      return;
    }
    file = f;
    pageCount = 0;
    downloadName = f.name.replace(/\.pdf$/i, '') + '.rotated.pdf';
    while (!ready && !error) {
      await new Promise((r) => setTimeout(r, 50));
    }
    try {
      const buf = await f.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
      pageCount = doc.getPageCount();
    } catch (e: any) {
      error = e?.message?.includes('encrypted') ? 'Encrypted PDF — unlock it first.' : 'Could not read this PDF.';
      file = null;
    }
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

  function parseRange(input: string, max: number): Set<number> {
    const out = new Set<number>();
    for (const part of input.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const m = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (a > 0 && b >= a) for (let i = a; i <= Math.min(b, max); i++) out.add(i - 1);
      } else {
        const n = parseInt(trimmed, 10);
        if (n > 0 && n <= max) out.add(n - 1);
      }
    }
    return out;
  }

  async function rotate() {
    if (!file || !ready) return;
    working = true;
    error = '';
    revoke();
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
      const pages = doc.getPages();
      const targetSet = scope === 'all' ? new Set(pages.map((_: any, i: number) => i)) : parseRange(rangeStr, pages.length);
      for (let i = 0; i < pages.length; i++) {
        if (targetSet.has(i)) {
          const current = pages[i].getRotation().angle;
          pages[i].setRotation(PDFLib.degrees((current + rotation) % 360));
        }
      }
      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      downloadUrl = URL.createObjectURL(blob);
    } catch (e: any) {
      error = `Rotation failed: ${e?.message ?? e}`;
    } finally {
      working = false;
    }
  }

  function revoke() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = '';
  }
  function reset() {
    revoke();
    file = null;
    pageCount = 0;
    error = '';
  }
</script>

<div class="space-y-4">
  <div class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
    on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="PDF drop zone">
    {#if !file}
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a PDF here, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium" on:click={() => fileInput.click()}>Choose PDF</button>
      <input bind:this={fileInput} type="file" accept="application/pdf,.pdf" class="hidden" on:change={onPick} />
    {:else}
      <p class="font-medium mb-1">{file.name}</p>
      <p class="text-xs text-[color:var(--color-text-mute)]">{pageCount} pages</p>
      <button class="mt-3 text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={reset}>Choose a different file</button>
    {/if}
  </div>

  {#if file && !downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
      <div>
        <p class="text-sm font-semibold mb-2">Rotation angle</p>
        <div class="grid grid-cols-3 gap-2">
          {#each [90, 180, 270] as deg}
            <button
              class="px-3 py-2 rounded-lg border text-sm font-medium transition-colors {rotation === deg ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10 text-[color:var(--color-brand-400)]' : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]'}"
              on:click={() => (rotation = deg as 90 | 180 | 270)}>{deg}°</button>
          {/each}
        </div>
      </div>

      <div>
        <p class="text-sm font-semibold mb-2">Apply to</p>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <label class="block p-3 rounded-lg border cursor-pointer text-sm {scope === 'all' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)]'}">
            <input type="radio" bind:group={scope} value="all" class="sr-only" />All pages
          </label>
          <label class="block p-3 rounded-lg border cursor-pointer text-sm {scope === 'range' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)]'}">
            <input type="radio" bind:group={scope} value="range" class="sr-only" />Specific pages
          </label>
        </div>
        {#if scope === 'range'}
          <input type="text" bind:value={rangeStr} placeholder="e.g. 1-3, 5, 7-9" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm" />
          <p class="text-xs text-[color:var(--color-text-mute)] mt-1">Total pages: {pageCount}</p>
        {/if}
      </div>

      <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={rotate} disabled={working}>
        {working ? 'Rotating…' : 'Rotate PDF'}
      </button>
    </div>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="font-semibold">Done! Pages rotated.</p>
      <a href={downloadUrl} download={downloadName} class="px-5 py-2.5 rounded-lg bg-[color:var(--color-success)] hover:opacity-90 text-white font-medium inline-flex items-center gap-2 whitespace-nowrap">
        Download
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  {/if}

  {#if error}
    <div class="p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm text-[color:var(--color-danger)]">{error}</div>
  {/if}
</div>
