<script lang="ts">
  // Net worth is a position across accounts, not a single statement — so this
  // is a manual calculator rather than a CSV parser. Entries are saved to this
  // browser's localStorage only (never sent anywhere).

  type Kind = 'asset' | 'liability';
  type Account = { id: number; name: string; kind: Kind; balance: string };

  let sym = $state('$');
  let accounts = $state<Account[]>([]);
  let nextId = 1;

  const STORAGE = 'vexyn-networth-v1';

  function seed(): Account[] {
    return [
      { id: nextId++, name: 'Checking account', kind: 'asset', balance: '' },
      { id: nextId++, name: 'Savings', kind: 'asset', balance: '' },
      { id: nextId++, name: 'Credit card', kind: 'liability', balance: '' },
    ];
  }

  // Load once on mount (guarded — storage can throw or be empty).
  $effect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data?.accounts) && data.accounts.length) {
          accounts = data.accounts.map((a: Account) => ({ ...a, id: nextId++ }));
          if (typeof data.sym === 'string') sym = data.sym;
          return;
        }
      }
    } catch {}
    accounts = seed();
  });

  // Persist on change (guarded).
  $effect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ accounts, sym }));
    } catch {}
  });

  function num(s: string): number {
    let x = (s || '').replace(/[^0-9.,-]/g, '');
    // Whichever separator appears last is the decimal one; the other is thousands.
    if (x.lastIndexOf(',') > x.lastIndexOf('.')) x = x.replace(/\./g, '').replace(',', '.');
    else x = x.replace(/,/g, '');
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : 0;
  }

  const assets = $derived(accounts.filter((a) => a.kind === 'asset'));
  const liabilities = $derived(accounts.filter((a) => a.kind === 'liability'));
  const totalAssets = $derived(assets.reduce((s, a) => s + Math.abs(num(a.balance)), 0));
  const totalLiabilities = $derived(liabilities.reduce((s, a) => s + Math.abs(num(a.balance)), 0));
  const netWorth = $derived(totalAssets - totalLiabilities);

  const assetSegments = $derived.by(() => {
    const colors = ['#10b981', '#14b8a6', '#38bdf8', '#a78bfa', '#84cc16', '#22d3ee', '#f59e0b', '#e879f9'];
    let acc = 0;
    return assets
      .map((a) => ({ name: a.name || 'Account', value: Math.abs(num(a.balance)) }))
      .filter((a) => a.value > 0)
      .map((a, i) => {
        const frac = totalAssets > 0 ? a.value / totalAssets : 0;
        const seg = { ...a, frac, start: acc, color: colors[i % colors.length], pct: Math.round(frac * 100) };
        acc += frac;
        return seg;
      });
  });

  const R = 60, SW = 26, C = 2 * Math.PI * R;

  function add(kind: Kind) { accounts = [...accounts, { id: nextId++, name: '', kind, balance: '' }]; }
  function remove(id: number) { accounts = accounts.filter((a) => a.id !== id); }
  function clearAll() { accounts = seed(); }
  function money(n: number): string { return sym + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(n: number): string { return (n < 0 ? '−' : '') + money(n); }
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <p class="text-sm text-[color:var(--color-text-mute)]">Enter what you own and what you owe. Nothing leaves your browser — entries are saved on this device only.</p>
    <label class="text-xs text-[color:var(--color-text-mute)] flex items-center gap-1.5">Currency
      <input bind:value={sym} maxlength="3" class="w-16 px-2 py-1 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-xs" />
    </label>
  </div>

  <!-- Net worth headline -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Assets</p><p class="text-xl font-bold text-[color:var(--color-success)]">{money(totalAssets)}</p></div>
    <div class="p-4 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Liabilities</p><p class="text-xl font-bold text-[color:var(--color-danger)]">{money(totalLiabilities)}</p></div>
    <div class="p-4 rounded-xl bg-gradient-to-br from-[color:var(--color-brand-500)]/10 to-[color:var(--color-accent-500)]/10 border border-[color:var(--color-brand-500)]/30"><p class="text-xs text-[color:var(--color-text-mute)] mb-1">Net worth</p><p class="text-2xl font-bold {netWorth < 0 ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-brand-400)]'}">{signed(netWorth)}</p></div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- Assets -->
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-2">
      <div class="flex items-center justify-between mb-1"><p class="text-sm font-semibold text-[color:var(--color-success)]">Assets — what you own</p></div>
      {#each assets as a (a.id)}
        <div class="flex items-center gap-2">
          <input bind:value={a.name} placeholder="Account name" class="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm" />
          <div class="relative w-32">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--color-text-dim)]">{sym}</span>
            <input bind:value={a.balance} inputmode="decimal" placeholder="0.00" class="w-full pl-7 pr-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm font-mono text-right" />
          </div>
          <button class="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)] p-1" title="Remove" on:click={() => remove(a.id)} aria-label="Remove account">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      {/each}
      <button class="text-sm text-[color:var(--color-brand-400)] hover:text-[color:var(--color-brand-300)] mt-1" on:click={() => add('asset')}>+ Add asset</button>
    </div>

    <!-- Liabilities -->
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] space-y-2">
      <div class="flex items-center justify-between mb-1"><p class="text-sm font-semibold text-[color:var(--color-danger)]">Liabilities — what you owe</p></div>
      {#each liabilities as a (a.id)}
        <div class="flex items-center gap-2">
          <input bind:value={a.name} placeholder="Loan / card name" class="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm" />
          <div class="relative w-32">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--color-text-dim)]">{sym}</span>
            <input bind:value={a.balance} inputmode="decimal" placeholder="0.00" class="w-full pl-7 pr-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-sm font-mono text-right" />
          </div>
          <button class="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)] p-1" title="Remove" on:click={() => remove(a.id)} aria-label="Remove liability">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      {/each}
      <button class="text-sm text-[color:var(--color-brand-400)] hover:text-[color:var(--color-brand-300)] mt-1" on:click={() => add('liability')}>+ Add liability</button>
    </div>
  </div>

  <!-- Asset composition -->
  {#if assetSegments.length}
    <div class="p-5 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
      <p class="text-sm font-semibold mb-4">What your assets are made of</p>
      <div class="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-6 items-center">
        <svg viewBox="0 0 160 160" class="w-40 mx-auto" role="img" aria-label="Assets by account">
          <g transform="rotate(-90 80 80)">
            {#each assetSegments as s}
              <circle cx="80" cy="80" r={R} fill="none" stroke={s.color} stroke-width={SW} stroke-dasharray="{s.frac * C} {C}" stroke-dashoffset={-s.start * C}><title>{s.name}: {money(s.value)} ({s.pct}%)</title></circle>
            {/each}
          </g>
          <text x="80" y="84" text-anchor="middle" font-size="12" font-weight="700" fill="var(--color-text)">{money(totalAssets)}</text>
        </svg>
        <div class="space-y-2 min-w-0">
          {#each assetSegments as s}
            <div class="flex items-center gap-3 text-sm">
              <span class="w-3 h-3 rounded-sm shrink-0" style="background:{s.color}"></span>
              <span class="flex-1 truncate">{s.name}</span>
              <span class="text-[color:var(--color-text-dim)] text-xs w-10 text-right">{s.pct}%</span>
              <span class="font-mono whitespace-nowrap w-28 text-right">{money(s.value)}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <button class="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)]" on:click={clearAll}>Reset to example</button>
    <p class="text-xs text-[color:var(--color-text-dim)]">Saved on this device only. Net worth = assets − liabilities, a snapshot of today.</p>
  </div>
</div>
