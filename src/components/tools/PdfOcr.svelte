<script lang="ts">
  import { onMount } from 'svelte';

  let PDFLib: any = $state(null);
  let pdfjsLib: any = $state(null);
  let Tesseract: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let pageCount = $state(0);
  let language = $state<'eng' | 'fra' | 'deu' | 'spa' | 'ron' | 'ita' | 'por' | 'nld'>('eng');
  let outputMode = $state<'text' | 'searchable'>('searchable');
  let working = $state(false);
  let progress = $state(0);
  let statusMsg = $state('');
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('ocr.txt');
  let downloadMime = $state('text/plain');
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  const langLabels: Record<string, string> = {
    eng: 'English', fra: 'Français', deu: 'Deutsch', spa: 'Español',
    ron: 'Română', ita: 'Italiano', por: 'Português', nld: 'Nederlands',
  };

  onMount(async () => {
    try {
      PDFLib = await import('pdf-lib');
      pdfjsLib = await import('pdfjs-dist');
      const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      Tesseract = await import('tesseract.js');
      ready = true;
    } catch (e: any) {
      error = `Could not load engines: ${e?.message ?? e}`;
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
    while (!ready && !error) await new Promise((r) => setTimeout(r, 50));
    try {
      const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      pageCount = pdf.numPages;
    } catch {
      error = 'Could not read this PDF.';
      file = null;
    }
  }

  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.[0]) pickFile(t.files[0]);
    t.value = '';
  }
  function onDrop(e: DragEvent) { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files?.[0]; if (f) pickFile(f); }
  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }

  async function runOcr() {
    if (!file || !ready) return;
    working = true;
    progress = 0;
    statusMsg = 'Loading language data…';
    error = '';
    revoke();
    try {
      const worker = await Tesseract.createWorker(language, 1, {
        logger: (m: any) => { if (m.status) statusMsg = m.status.replace(/^./, (c: string) => c.toUpperCase()); },
      });
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const total = pdf.numPages;

      if (outputMode === 'text') {
        let allText = '';
        for (let i = 1; i <= total; i++) {
          statusMsg = `OCR page ${i}/${total}…`;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise;
          const { data } = await worker.recognize(canvas);
          allText += `\n\n--- Page ${i} ---\n\n${data.text}`;
          canvas.width = 0; canvas.height = 0;
          progress = Math.round((i / total) * 100);
        }
        downloadName = file.name.replace(/\.pdf$/i, '') + '.ocr.txt';
        downloadMime = 'text/plain';
        downloadUrl = URL.createObjectURL(new Blob([allText.trim()], { type: 'text/plain' }));
      } else {
        // Searchable PDF: image + invisible text layer
        const out = await PDFLib.PDFDocument.create();
        const font = await out.embedFont(PDFLib.StandardFonts.Helvetica);

        for (let i = 1; i <= total; i++) {
          statusMsg = `OCR page ${i}/${total}…`;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise;

          const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.85));
          const jpgBytes = new Uint8Array(await blob.arrayBuffer());
          const img = await out.embedJpg(jpgBytes);

          const { data } = await worker.recognize(canvas);

          const pageW = viewport.width / 2; // back to original PDF coords
          const pageH = viewport.height / 2;
          const p = out.addPage([pageW, pageH]);
          p.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });

          // Draw invisible text layer for searchability
          for (const word of data.words ?? []) {
            const x = word.bbox.x0 / 2;
            const y = pageH - word.bbox.y1 / 2; // flip Y
            const w = (word.bbox.x1 - word.bbox.x0) / 2;
            const h = (word.bbox.y1 - word.bbox.y0) / 2;
            if (!word.text || w <= 0 || h <= 0) continue;
            const fontSize = h * 0.85;
            try {
              p.drawText(word.text, { x, y, font, size: fontSize, opacity: 0 });
            } catch {
              // Skip text that includes characters Helvetica can't encode
            }
          }

          canvas.width = 0; canvas.height = 0;
          progress = Math.round((i / total) * 100);
        }

        statusMsg = 'Building PDF…';
        const bytes = await out.save({ useObjectStreams: true });
        downloadName = file.name.replace(/\.pdf$/i, '') + '.searchable.pdf';
        downloadMime = 'application/pdf';
        downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      }

      await worker.terminate();
      statusMsg = '';
    } catch (e: any) {
      error = `OCR failed: ${e?.message ?? e}`;
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
    statusMsg = '';
  }
</script>

<div class="space-y-4">
  <div class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
    on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="PDF drop zone">
    {#if !file}
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a scanned PDF, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium" on:click={() => fileInput.click()}>Choose PDF</button>
      <input bind:this={fileInput} type="file" accept="application/pdf,.pdf" class="hidden" on:change={onPick} />
    {:else}
      <p class="font-medium mb-1">{file.name}</p>
      <p class="text-xs text-[color:var(--color-text-mute)]">{pageCount} pages</p>
      <button class="mt-2 text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={reset}>Choose a different file</button>
    {/if}
  </div>

  {#if file && !downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-4">
      <div>
        <p class="text-sm font-semibold mb-2">Output</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label class="block p-3 rounded-lg border cursor-pointer {outputMode === 'searchable' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)]'}">
            <input type="radio" bind:group={outputMode} value="searchable" class="sr-only" />
            <p class="font-medium text-sm">Searchable PDF</p>
            <p class="text-xs text-[color:var(--color-text-mute)] mt-1">Original look + invisible text layer. Search and copy-paste work.</p>
          </label>
          <label class="block p-3 rounded-lg border cursor-pointer {outputMode === 'text' ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/10' : 'border-[color:var(--color-border)]'}">
            <input type="radio" bind:group={outputMode} value="text" class="sr-only" />
            <p class="font-medium text-sm">Plain text (.txt)</p>
            <p class="text-xs text-[color:var(--color-text-mute)] mt-1">Just the text, no layout. Smaller download.</p>
          </label>
        </div>
      </div>

      <label class="text-sm block">
        <span class="font-semibold block mb-1">Language</span>
        <select bind:value={language} class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
          {#each Object.entries(langLabels) as [code, label]}
            <option value={code}>{label}</option>
          {/each}
        </select>
        <p class="text-xs text-[color:var(--color-text-mute)] mt-1">First run downloads ~3-10 MB of language data (cached after).</p>
      </label>

      <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={runOcr} disabled={working}>
        {#if working}
          OCR running… {progress}% — {statusMsg}
        {:else}
          Run OCR on {pageCount} page{pageCount > 1 ? 's' : ''}
        {/if}
      </button>
      {#if working}
        <p class="text-xs text-[color:var(--color-text-mute)] text-center">OCR takes 5-20 seconds per page. Don't close this tab.</p>
      {/if}
    </div>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="font-semibold">OCR complete.</p>
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
