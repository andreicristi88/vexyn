/**
 * Svelte action: enable swipe-to-dismiss on touch.
 * Usage: <div use:swipeable={{ onSwipe: () => remove(it.id) }}>...</div>
 * Only triggers on touch devices; mouse interactions untouched.
 */
type Opts = {
  onSwipe: (dir: 'left' | 'right') => void;
  /** Pixels of drag needed before dismiss fires (default 90). */
  threshold?: number;
  /** Direction(s) to allow (default both). */
  allow?: 'left' | 'right' | 'both';
};

export function swipeable(node: HTMLElement, opts: Opts) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let active = false;
  let decided = false;
  const threshold = opts.threshold ?? 90;
  const allow = opts.allow ?? 'both';

  function reset(animate: boolean) {
    node.style.transition = animate ? 'transform 200ms ease, opacity 200ms ease' : 'none';
    node.style.transform = '';
    node.style.opacity = '';
    currentX = 0;
  }

  function onStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    active = true;
    decided = false;
    node.style.transition = 'none';
  }

  function onMove(e: TouchEvent) {
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (!decided) {
      // Lock direction on first significant movement
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical: let the page scroll, abort swipe
        active = false;
        return;
      }
      decided = true;
    }

    // Restrict by allowed direction
    if (allow === 'left' && dx > 0) return;
    if (allow === 'right' && dx < 0) return;

    currentX = dx;
    node.style.transform = `translateX(${dx}px)`;
    node.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 300));
  }

  function onEnd() {
    if (!active) return;
    active = false;
    if (!decided) return reset(false);

    if (Math.abs(currentX) > threshold) {
      node.style.transition = 'transform 200ms ease, opacity 200ms ease';
      node.style.transform = `translateX(${currentX > 0 ? 800 : -800}px)`;
      node.style.opacity = '0';
      const dir: 'left' | 'right' = currentX > 0 ? 'right' : 'left';
      window.setTimeout(() => opts.onSwipe(dir), 180);
    } else {
      reset(true);
    }
  }

  node.addEventListener('touchstart', onStart, { passive: true });
  node.addEventListener('touchmove', onMove, { passive: true });
  node.addEventListener('touchend', onEnd, { passive: true });
  node.addEventListener('touchcancel', onEnd, { passive: true });

  return {
    destroy() {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
    },
  };
}
