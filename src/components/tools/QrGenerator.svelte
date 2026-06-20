<script lang="ts">
  import QRCode from 'qrcode';

  let text = $state('https://vexyn.app');
  let size = $state(512);
  let margin = $state(2);
  let level = $state<'L' | 'M' | 'Q' | 'H'>('M');
  let fg = $state('#0a0a0f');
  let bg = $state('#ffffff');
  let dataUrl = $state('');
  let svgString = $state('');
  let error = $state('');

  async function generate() {
    error = '';
    if (!text) {
      dataUrl = '';
      svgString = '';
      return;
    }
    try {
      dataUrl = await QRCode.toDataURL(text, {
        errorCorrectionLevel: level,
        margin,
        width: size,
        color: { dark: fg, light: bg },
      });
      svgString = await QRCode.toString(text, {
        type: 'svg',
        errorCorrectionLevel: level,
        margin,
        width: size,
        color: { dark: fg, light: bg },
      });
    } catch (e: any) {
      error = e.message || 'Could not generate QR code.';
    }
  }

  $effect(() => {
    void text; void size; void margin; void level; void fg; void bg;
    generate();
  });

  function download(type: 'png' | 'svg') {
    const data = type === 'png' ? dataUrl : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    const a = document.createElement('a');
    a.href = data;
    a.download = `qr-code.${type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
</script>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
  <!-- Controls -->
  <div class="space-y-5">
    <div>
      <label for="qr-text" class="block text-sm font-medium text-[color:var(--color-text-mute)] mb-2">Text or URL</label>
      <textarea
        id="qr-text"
        bind:value={text}
        rows="4"
        placeholder="https://example.com"
        class="w-full p-3 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-dim)] resize-none focus:border-[color:var(--color-brand-500)] focus:outline-none transition-colors"
      ></textarea>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="qr-size" class="block text-sm font-medium text-[color:var(--color-text-mute)] mb-2">Size: {size}px</label>
        <input
          id="qr-size"
          type="range"
          bind:value={size}
          min="128"
          max="1024"
          step="32"
          class="w-full"
        />
      </div>
      <div>
        <label for="qr-margin" class="block text-sm font-medium text-[color:var(--color-text-mute)] mb-2">Margin: {margin}</label>
        <input
          id="qr-margin"
          type="range"
          bind:value={margin}
          min="0"
          max="8"
          step="1"
          class="w-full"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="qr-level" class="block text-sm font-medium text-[color:var(--color-text-mute)] mb-2">Error correction</label>
        <select
          id="qr-level"
          bind:value={level}
          class="w-full p-2 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-brand-500)] focus:outline-none"
        >
          <option value="L">Low (7%)</option>
          <option value="M">Medium (15%)</option>
          <option value="Q">Quartile (25%)</option>
          <option value="H">High (30%)</option>
        </select>
      </div>
      <div>
        <span class="block text-sm font-medium text-[color:var(--color-text-mute)] mb-2">Colors</span>
        <div class="flex items-center gap-2">
          <input type="color" bind:value={fg} class="w-10 h-10 rounded border border-[color:var(--color-border)] bg-transparent cursor-pointer" aria-label="Foreground" />
          <input type="color" bind:value={bg} class="w-10 h-10 rounded border border-[color:var(--color-border)] bg-transparent cursor-pointer" aria-label="Background" />
        </div>
      </div>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        onclick={() => download('png')}
        disabled={!dataUrl}
        class="flex-1 px-4 py-2 rounded-lg bg-[color:var(--color-brand-500)] hover:bg-[color:var(--color-brand-600)] text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Download PNG
      </button>
      <button
        onclick={() => download('svg')}
        disabled={!svgString}
        class="flex-1 px-4 py-2 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] text-[color:var(--color-text)] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Download SVG
      </button>
    </div>
  </div>

  <!-- Preview -->
  <div class="flex flex-col items-center justify-center p-8 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] min-h-[400px]">
    {#if dataUrl}
      <img src={dataUrl} alt="QR code preview" class="max-w-full max-h-[400px] rounded" />
    {:else if error}
      <p class="text-sm text-[color:var(--color-danger)]">{error}</p>
    {:else}
      <p class="text-sm text-[color:var(--color-text-dim)]">Enter text to generate a QR code</p>
    {/if}
  </div>
</div>
