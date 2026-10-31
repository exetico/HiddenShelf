// The app loads the whole shelf once and works out what to show here, in
// the browser: search, the category and tag filters, hidden categories and
// sorting. So a search or a filter shows at once, with no request.
// These mirror the server's own rules in backend/src/routes/links.js.

/** Lower-case text for matching; SQLite's LIKE ignores case too */
const fold = (value) => String(value ?? "").toLowerCase();

/** True if the search text is in the title, description, address or a tag name */
export function matchesSearch(link, search) {
  const term = fold(search).trim();
  if (!term) return true;
  return (
    fold(link.title).includes(term) ||
    fold(link.description).includes(term) ||
    fold(link.url).includes(term) ||
    (link.tags || []).some((t) => fold(t.name).includes(term))
  );
}

const byTitle = (a, b) =>
  String(a.title ?? "").localeCompare(String(b.title ?? ""), undefined, {
    sensitivity: "base",
  });
// created_at is "YYYY-MM-DD HH:MM:SS", so text order is time order
const byCreated = (a, b) =>
  String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
const byId = (a, b) => (a.id ?? 0) - (b.id ?? 0);

// "" is your own order: positions you set, then newest
const SORTERS = {
  "": (a, b) => {
    const aSet = a.display_order != null;
    const bSet = b.display_order != null;
    if (aSet !== bSet) return aSet ? -1 : 1;
    if (aSet && a.display_order !== b.display_order) return a.display_order - b.display_order;
    return byCreated(b, a);
  },
  newest: (a, b) => byCreated(b, a) || byId(b, a),
  oldest: (a, b) => byCreated(a, b) || byId(a, b),
  title: (a, b) => byTitle(a, b) || byId(a, b),
  title_desc: (a, b) => byTitle(b, a) || byId(b, a),
  visits: (a, b) => (b.total_visits || 0) - (a.total_visits || 0) || byCreated(b, a),
};

/** A sorted copy */
export function sortLinks(links, sort = "") {
  return [...links].sort(SORTERS[sort] || SORTERS[""]);
}

/** Ids of your own hidden categories */
export function hiddenCategoryIds(categories) {
  return new Set(categories.filter((c) => c.is_hidden).map((c) => c.id));
}

/**
 * What to show for a set of filters.
 * - category: a category id, "uncategorized", or "" for all. Picking a
 *   category shows it, hidden or not.
 * - Links in hidden categories stay out otherwise, unless `showHidden`.
 *   `hiddenMatches` says how many a search or tag filter left out, so the
 *   page can offer them.
 */
export function selectLinks(
  allLinks,
  { search = "", category = "", tag = "", sort = "", showHidden = false, hiddenIds = new Set() } = {},
) {
  const tagId = tag ? String(tag) : "";
  const matches = allLinks.filter((link) => {
    if (category === "uncategorized" && link.category_id != null) return false;
    if (category && category !== "uncategorized" && String(link.category_id) !== String(category))
      return false;
    if (tagId && !(link.tags || []).some((t) => String(t.id) === tagId)) return false;
    return matchesSearch(link, search);
  });

  let shown = matches;
  let hiddenMatches = 0;
  if (!category && !showHidden) {
    shown = matches.filter((link) => !hiddenIds.has(link.category_id));
    if (search.trim() || tagId) hiddenMatches = matches.length - shown.length;
  }
  return { links: sortLinks(shown, sort), hiddenMatches };
}

/** Your own starred links outside hidden categories, by title */
export function favoriteLinks(allLinks, hiddenIds = new Set()) {
  return allLinks
    .filter(
      (link) =>
        link.is_favorite && !link.is_from_shared_category && !hiddenIds.has(link.category_id),
    )
    .sort(byTitle);
}
