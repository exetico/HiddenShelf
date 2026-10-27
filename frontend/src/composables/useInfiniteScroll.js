import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";

/**
 * Calls `loadMore` when the returned `sentinel` element comes within
 * `margin` pixels of the bottom of the screen, one page at a time. After
 * each page it measures again, once the new items are on screen, and only
 * loads another if the sentinel is still that close (a short page, or a
 * tall screen). `count()` is how many items are loaded; a page that adds
 * none (an error) stops until the list changes or the user scrolls again.
 * Without IntersectionObserver nothing happens and the page's "Load more"
 * button still works.
 */
export function useInfiniteScroll({ hasMore, loadMore, count, margin = 200 }) {
  const sentinel = ref(null);
  let observer = null;
  let busy = false;

  // Measured, not remembered: an observer's last answer goes stale as soon
  // as new items push the sentinel down
  function near() {
    const el = sentinel.value;
    if (!el || !el.isConnected) return false;
    return el.getBoundingClientRect().top <= window.innerHeight + margin;
  }

  // Wait until new items are rendered and laid out before measuring
  async function settle() {
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function pull() {
    if (busy) return;
    busy = true;
    try {
      while (hasMore() && near()) {
        const before = count();
        await loadMore();
        await settle();
        if (count() <= before) break;
      }
    } catch {
      // The store shows its own error; scrolling again retries
    } finally {
      busy = false;
    }
  }

  onMounted(() => {
    if (typeof IntersectionObserver === "undefined" || !sentinel.value) return;
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) pull();
      },
      { rootMargin: `0px 0px ${margin}px 0px` },
    );
    observer.observe(sentinel.value);
  });

  // The observer only fires when visibility changes. When the list changes
  // under a sentinel that stays on screen (a filter, a reload), look again
  watch([count, hasMore], async () => {
    if (!observer) return;
    await settle();
    pull();
  });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
  });

  return { sentinel };
}
