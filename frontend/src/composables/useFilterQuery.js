import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { filterQuery } from "@/lib/filterLinks";

/**
 * Keeps the list filters and the address bar in step on View and Edit:
 * ?category=3, ?tag=7, ?q=text and ?sort=title. Opening such an address applies them;
 * changing a filter updates the address (replace, so Back still leaves the
 * page).
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
      sort: appStore.sort,
    });
  const fromRoute = () =>
    filterQuery({
      category: route.query.category,
      tag: route.query.tag,
      q: route.query.q,
      sort: route.query.sort,
    });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Address → filters: on arrival, and for Back/Forward or a link to this page
  function applyRoute() {
    const wanted = fromRoute();
    if (same(wanted, fromStore())) return;
    const tagChanged = (wanted.tag || "") !== appStore.filterTag;
    appStore.filterCategory = wanted.category || "";
    if ((wanted.q || "") !== appStore.search.trim()) appStore.search = wanted.q || "";
    if ((wanted.sort || "") !== appStore.sort) appStore.setSort(wanted.sort || "");
    if (tagChanged) appStore.filterByTag(wanted.tag || "");
  }

  // Arriving without filters in the address keeps the current ones (e.g.
  // switching from View to Edit, or the sort you picked last time), and
  // writes them into the address
  if (Object.keys(fromRoute()).length) applyRoute();

  // Filters → address
  function writeRoute() {
    const wanted = fromStore();
    if (same(wanted, fromRoute())) return;
    const rest = { ...route.query };
    delete rest.category;
    delete rest.tag;
    delete rest.q;
    delete rest.sort;
    router.replace({ query: { ...rest, ...wanted } });
  }
  writeRoute();

  watch(
    () => [appStore.filterCategory, appStore.filterTag, appStore.search, appStore.sort],
    writeRoute,
  );
  watch(() => route.query, applyRoute);
}
