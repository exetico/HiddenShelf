import { onUnmounted, watch } from "vue";
import { useAppStore } from "@/stores/app";

/**
 * Reloads the links when the search or category filter changes. Typing
 * waits until it pauses (`delay` ms), so a word is one request, not one per
 * key; clearing the search and picking a category reload right away.
 * Tag filters reload through appStore.filterByTag itself. A new search
 * starts without the hidden categories again.
 */
export function useLinkFilterReload({ delay = 300 } = {}) {
  const appStore = useAppStore();
  let timer = null;
  let lastSearch = appStore.search.trim();

  function reload() {
    clearTimeout(timer);
    timer = null;
    lastSearch = appStore.search.trim();
    appStore.showHidden = false;
    appStore.loadLinks({ reset: true });
  }

  watch(
    () => appStore.search,
    (value) => {
      const search = value.trim();
      clearTimeout(timer);
      // Only spaces changed: same results
      if (search === lastSearch) return;
      if (!search) reload();
      else timer = setTimeout(reload, delay);
    },
  );
  watch(() => appStore.filterCategory, reload);
  watch(() => appStore.sort, reload);

  onUnmounted(() => clearTimeout(timer));
}
