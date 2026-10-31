/** "1 link", "3 links", "0 links" */
export function linkCount(count) {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? "link" : "links"}`;
}

/**
 * The count above a list. "12 links" for the whole shelf; "Showing 3 of
 * 12 links" while searching or filtering. A hidden category can show more
 * than the shelf's count (which leaves hidden ones out), so then it's
 * just "15 links".
 */
export function shownCount(shown, total, filtering) {
  if (!filtering || shown > total) return linkCount(shown);
  return `Showing ${shown} of ${linkCount(total)}`;
}
