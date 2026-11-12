// Saved searches: a name and the View/Edit filters (category, tag, q, sort,
// toread), kept in your settings and shown as chips. The filters are the
// same ones the address bar holds (lib/filterLinks.js).

import { filterQuery } from "@/lib/filterLinks";

export const MAX_SAVED_SEARCHES = 30;
export const MAX_SAVED_NAME = 60;

/** The filters that are on now, as a saved search's query */
export function currentQuery(appStore) {
  return filterQuery({
    category: appStore.filterCategory,
    tag: appStore.filterTag,
    q: appStore.search,
    sort: appStore.sort,
    toread: appStore.filterToRead,
  });
}

/**
 * Is this saved search what's showing? Category, tag, search and To read
 * must match; the sort only when the saved search has one.
 */
export function isActive(saved, current) {
  const q = saved?.query || {};
  for (const key of ["category", "tag", "q", "toread"]) {
    if ((q[key] || "") !== (current[key] || "")) return false;
  }
  return !q.sort || q.sort === (current.sort || "");
}

/** A name for the filters that are on, e.g. "Recipes + #dinner + weeknight" */
export function suggestName(query, { categories = [], tags = [] } = {}) {
  const parts = [];
  if (query.toread) parts.push("To read");
  if (query.category === "uncategorized") parts.push("Uncategorized");
  else if (query.category) {
    const cat = categories.find((c) => String(c.id) === String(query.category));
    parts.push(cat?.name || "Category");
  }
  if (query.tag) {
    const tag = tags.find((t) => String(t.id) === String(query.tag));
    parts.push(`#${tag?.name || "tag"}`);
  }
  if (query.q) parts.push(query.q);
  return parts.join(" + ").slice(0, MAX_SAVED_NAME) || "My search";
}

/** Puts a saved search's filters on the store */
export function applySaved(appStore, saved) {
  const q = saved?.query || {};
  appStore.filterCategory = q.category || "";
  appStore.search = q.q || "";
  appStore.filterToRead = q.toread === "1";
  if ((q.tag || "") !== appStore.filterTag) appStore.filterByTag(q.tag || "");
  if (q.sort && q.sort !== appStore.sort) appStore.setSort(q.sort);
}
