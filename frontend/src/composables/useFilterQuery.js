import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { filterQuery } from "@/lib/filterLinks";

/**
 * Keeps the list filters and the address bar in step on View and Edit:
 * ?category=3, ?tag=7 and ?q=text. Opening such an address applies them;
 * changing a filter updates the address (replace, so Back still leaves the
 * page). Call it before useLinkFilterReload, so the first load already
 * uses the filters from the address.
 */
export function useFilterQuery() {
  const route = useRoute();
  const router = useRouter();
  const appStore = useAppStore();

  const fromStore = () =>
    filterQuery({
      category: appStore.filterCategory,
      tag: appStore.filterTag,
      q: appStore.search,
    });
  const fromRoute = () =>
    filterQuery({
      category: route.query.category,
      tag: route.query.tag,
      q: route.query.q,
    });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Address → filters: on arrival, and for Back/Forward or a link to this page
  function applyRoute() {
    const wanted = fromRoute();
    if (same(wanted, fromStore())) return;
    const tagChanged = (wanted.tag || "") !== appStore.filterTag;
    appStore.filterCategory = wanted.category || "";
    if ((wanted.q || "") !== appStore.search.trim()) appStore.search = wanted.q || "";
    // filterByTag reloads; set it directly when nothing has loaded yet
    if (tagChanged) {
      if (appStore.settingsLoaded) appStore.filterByTag(wanted.tag || "");
      else appStore.filterTag = wanted.tag || "";
    }
  }

  // Arriving without filters in the address keeps the current ones (e.g.
  // switching from View to Edit), and writes them into the address
  if (Object.keys(fromRoute()).length) applyRoute();

  // Filters → address
  function writeRoute() {
    const wanted = fromStore();
    if (same(wanted, fromRoute())) return;
    const rest = { ...route.query };
    delete rest.category;
    delete rest.tag;
    delete rest.q;
    router.replace({ query: { ...rest, ...wanted } });
  }
  writeRoute();

  watch(
    () => [appStore.filterCategory, appStore.filterTag, appStore.search],
    writeRoute,
  );
  watch(() => route.query, applyRoute);
}
