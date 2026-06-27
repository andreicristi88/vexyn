<script lang="ts">
  import { onMount } from 'svelte';

  let CantooPDFLib: any = $state(null);
  let ready = $state(false);

  let file = $state<File | null>(null);
  let password = $state('');
  let working = $state(false);
  let error = $state('');
  let downloadUrl = $state('');
  let downloadName = $state('unlocked.pdf');
  let dragOver = $state(false);

  let fileInput: HTMLInputElement;

  onMount(async () => {
    try {
      CantooPDFLib = await import('@cantoo/pdf-lib');
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
    downloadName = f.name.replace(/\.pdf$/i, '') + '.unlocked.pdf';
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

  async function unlock() {
    if (!file || !ready) return;
    working = true;
    error = '';
    revoke();
    try {
      const buf = await file.arrayBuffer();
      // Load with the supplied password. @cantoo/pdf-lib uses LoadOptions.password
      // to decrypt the document into memory; saving without further encrypt()
      // produces an unencrypted output.
      const doc = await CantooPDFLib.PDFDocument.load(buf, {
        password,
        ignoreEncryption: false,
      });
      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      downloadUrl = URL.createObjectURL(blob);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error('[PdfUnlocker] failed', e);
      if (/password|encrypt|decrypt/i.test(msg)) {
        error = 'Wrong password — or this PDF uses an encryption method we cannot handle. Try the owner password if you have one.';
      } else {
        error = `Unlock failed: ${msg}`;
      }
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
    password = '';
    error = '';
  }
</script>

<div class="space-y-4">
  <div class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {dragOver ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)]/5' : 'border-[color:var(--color-border)]'}"
    on:dragover={onDragOver} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="PDF drop zone">
    {#if !file}
      <p class="text-[color:var(--color-text-mute)] mb-3">Drop a password-protected PDF, or</p>
      <button class="px-5 py-2.5 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium" on:click={() => fileInput.click()}>Choose PDF</button>
      <input bind:this={fileInput} type="file" accept="application/pdf,.pdf" class="hidden" on:change={onPick} />
    {:else}
      <p class="font-medium mb-1">{file.name}</p>
      <button class="mt-2 text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={reset}>Choose a different file</button>
    {/if}
  </div>

  {#if file && !downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-3">
      <label class="text-sm">
        <span class="font-semibold block mb-2">Password</span>
        <input type="password" bind:value={password} placeholder="Enter the PDF's password" class="w-full px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]" />
      </label>
      <p class="text-xs text-[color:var(--color-text-mute)]">
        This tool removes the password if you know it. It doesn't crack unknown passwords — that's a different problem and we won't help with it.
      </p>
      <button class="w-full px-5 py-3 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium disabled:opacity-50" on:click={unlock} disabled={working || !password}>
        {working ? 'Unlocking…' : 'Unlock PDF'}
      </button>
    </div>
  {/if}

  {#if downloadUrl}
    <div class="p-5 rounded-xl bg-[color:var(--color-success)]/10 border border-[color:var(--color-success)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="font-semibold">Unlocked.</p>
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
