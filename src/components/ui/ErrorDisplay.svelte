<script lang="ts">
  type Props = {
    message: string;
    hint?: string;
    onRetry?: (() => void) | null;
    issueTitle?: string;
  };
  let { message, hint = '', onRetry = null, issueTitle = 'Bug report' }: Props = $props();

  const issueUrl = $derived(
    `https://github.com/andreicristi88/vexyn/issues/new?title=${encodeURIComponent(issueTitle + ': ' + message)}&labels=bug`,
  );
</script>

<div role="alert" class="mt-4 p-4 rounded-lg bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30">
  <div class="flex items-start gap-3">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[color:var(--color-danger)] flex-shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-[color:var(--color-danger)] break-words">{message}</p>
      {#if hint}
        <p class="text-xs text-[color:var(--color-text-mute)] mt-1.5 leading-relaxed">{hint}</p>
      {/if}
      <div class="flex flex-wrap gap-2 mt-3">
        {#if onRetry}
          <button
            onclick={onRetry}
            class="text-xs px-3 py-1.5 rounded border border-[color:var(--color-danger)]/40 text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/15 transition-colors font-medium"
          >
            Try again
          </button>
        {/if}
        <a
          href={issueUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs px-3 py-1.5 rounded border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] transition-colors inline-flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
          Report on GitHub
        </a>
      </div>
    </div>
  </div>
</div>
