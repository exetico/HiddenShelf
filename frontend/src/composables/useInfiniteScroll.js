import { onMounted, onUnmounted, ref, watch } from "vue";

/**
 * Calls `loadMore` when the returned `sentinel` element scrolls near the
 * screen (600px ahead), and keeps going while it stays in view and
 * `hasMore()` is true. `count()` is how many items are loaded; a page that
 * adds none (an error) stops the loop until the list changes or the
 * sentinel scrolls into view again.
 * Without IntersectionObserver nothing happens and the page's "Load more"
 * button still works.
 */
export function useInfiniteScroll({ hasMore, loadMore, count, margin = "600px" }) {
  const sentinel = ref(null);
  let observer = null;
  let visible = false;
  let busy = false;

  async function pull() {
    if (busy) return;
    busy = true;
    try {
      while (visible && hasMore()) {
        const before = count();
        await loadMore();
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
        visible = entries.some((e) => e.isIntersecting);
        if (visible) pull();
      },
      { rootMargin: `0px 0px ${margin} 0px` },
    );
    observer.observe(sentinel.value);
  });

  // The observer only fires when visibility changes. If the sentinel is
  // still on screen after the list changes (a short first page, or a
  // filter), check again so loading keeps going
  watch([count, hasMore], () => {
    if (visible) pull();
  });

  onUnmounted(() => observer?.disconnect());

  return { sentinel };
}
