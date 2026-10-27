// Filters live in the address bar (/view?category=3&tag=7&q=grafana&sort=title), so a
// filtered list can be bookmarked, shared with yourself or opened in a new
// tab. These build those addresses.

/** The query for a set of filters, leaving out the empty ones */
export function filterQuery({ category = "", tag = "", q = "", sort = "" } = {}) {
  const query = {};
  if (category) query.category = String(category);
  if (tag) query.tag = String(tag);
  if (q && String(q).trim()) query.q = String(q).trim();
  if (sort) query.sort = String(sort);
  return query;
}

/** Path within the app, e.g. filterPath("view", { tag: 7 }) → "/view?tag=7" */
export function filterPath(page, filters) {
  const params = new URLSearchParams(filterQuery(filters)).toString();
  return `/${page}${params ? `?${params}` : ""}`;
}

/** href for a link to a filtered list, under BASE_PATH */
export function filterHref(page, filters, base = import.meta.env.BASE_URL) {
  return `${base.replace(/\/$/, "")}${filterPath(page, filters)}`;
}

/**
 * True for an ordinary left click. Ctrl/⌘/Shift/middle clicks are left to
 * the browser, so they open the filtered list in a new tab or window.
 */
export function isPlainClick(event) {
  return !(event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
