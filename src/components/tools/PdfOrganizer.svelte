<script lang="ts">
  import { onMount } from 'svelte';

  type PageItem = { id: string; originalIndex: number; thumb: string; keep: boolean };

  let PDFLib: any = $state(null);
  let pdfjsLib: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let pages = $state<PageItem[]>([]);
  let working = $state(false);
  let buildingThumbs = $state(false);
  let progress = $state(0);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('organized.pdf');
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      PDFLib = await import('pdf-lib');
      pdfjsLib = await import('pdfjs-dist');
      const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      ready = true;
    } catch (e: any) {
      error = `Could not load engines: ${e?.message ?? e}`;
    }
  });

  function uid() { return Math.random().toString(36).slice(2, 10); }

  async function pickFile(f: File) {
    revoke();
    clearPages();
    error = '';
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) {
      error = 'Drop a PDF (.pdf).';
      return;
    }
    file = f;
    downloadName = f.name.replace(/\.pdf$/i, '') + '.organized.pdf';
    while (!ready && !error) await new Promise((r) => setTimeout(r, 50));

    buildingThumbs = true;
    try {
      const buf = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const newPages: PageItem[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise;
        const thumb = canvas.toDataURL('image/jpeg', 0.6);
        newPages.push({ id: uid(), originalIndex: i - 1, thumb, keep: true });
        canvas.width = 0; canvas.height = 0;
      }
      pages = newPages;
    } catch {
      error = 'Could not read this PDF.';
      file = null;
    } finally {
      buildingThumbs = false;
    }
  }

  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.[0]) pickFile(t.files[0]);
    t.value = '';
  }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) pickFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }

  function toggleKeep(id: string) {
    const idx = pages.findIndex((p) => p.id === id);
    if (idx !== -1) pages[idx].keep = !pages[idx].keep;
  }

  function move(id: string, dir: -1 | 1) {
    const idx = pages.findIndex((p) => p.id === id);
    const j = idx + dir;
    if (idx === -1 || j < 0 || j >= pages.length) return;
    const arr = [...pages];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    pages = arr;
  }

  async function build() {
    if (!file || !ready) return;
    const keptPages = pages.filter((p) => p.keep);
    if (keptPages.length === 0) {
      error = 'Keep at least one page.';
      return;
    }
    working = true;
    progress = 0;
    error = '';
    revoke();
    try {
      const src = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
      const out = await PDFLib.PDFDocument.create();
      const indices = keptPages.map((p) => p.originalIndex);
      const copied = await out.copyPages(src, indices);
      for (let i = 0; i < copied.length; i++) {
        out.addPage(copied[i]);
        progress = Math.round(((i + 1) / copied.length) * 100);
      }
      const bytes = await out.save();
      downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    } catch (e: any) {
      error = e?.message?.includes('encrypted') ? 'Encrypted PDF — unlock it first.' : `Build failed: ${e?.message ?? e}`;
    } finally {
      working = false;
    }
  }

  function revoke() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = '';
  }
  function clearPages() {
    pages = [];
  }
  function reset() {
    revoke();
    clearPages();
    file = null;
    error = '';
  }

  let keptCount = $derived(pages.filter((p) => p.keep).length);
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
      <p class="text-xs text-[color:var(--color-text-mute)]">{pages.length} pages · {keptCount} kept</p>
      <button class="mt-2 text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={reset}>Choose a different file</button>
    {/if}
  </div>

  {#if buildingThumbs}
    <p class="text-sm text-[color:var(--color-text-mute)] text-center">Rendering page previews…</p>
  {/if}

  {#if pages.length > 0 && !downloadUrl}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {#each pages as p, i (p.id)}
        <div class="relative rounded-lg border bg-[color:var(--color-surface)] overflow-hidden {!p.keep ? 'opacity-40' : 'border-[color:var(--color-border)]'}">
          <img src={p.thumb} alt={`Page ${p.originalIndex + 1}`} class="w-full aspect-[3/4] object-contain bg-white" />
          <div class="p-2 flex items-center justify-between text-xs">
            <span class="font-mono text-[color:var(--color-text-mute)]">#{p.originalIndex + 1} → pos {i + 1}</span>
            <div class="flex gap-1">
              <button class="px-1.5 py-0.5 rounded hover:bg-[color:var(--color-surface-2)] disabled:opacity-30" on:click={() => move(p.id, -1)} disabled={i === 0} aria-label="Move left">←</button>
              <button class="px-1.5 py-0.5 rounded hover:bg-[color:var(--color-surface-2)] disabled:opacity-30" on:click={() => move(p.id, 1)} disabled={i === pages.length - 1} aria-label="Move right">→</button>
              <button class="px-1.5 py-0.5 rounded hover:bg-[color:var(--color-danger)]/20 {p.keep ? '' : 'bg-[color:var(--color-danger)]/30'}" on:click={() => toggleKeep(p.id)} aria-label="Toggle keep">{p.keep ? '×' : '+'}</button>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={build} disabled={working || keptCount === 0}>
      {working ? `Building… ${progress}%` : `Build PDF — ${keptCount} page${keptCount !== 1 ? 's' : ''} in this order`}
    </button>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="font-semibold">Reorganized.</p>
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
