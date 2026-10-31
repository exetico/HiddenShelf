import { etag } from "hono/etag";

/**
 * For lists the app loads whole and keeps in memory (links, categories,
 * tags, shared categories). Each answer carries an ETag; the app sends it
 * back (If-None-Match) and gets "304 Not Modified" with no body when
 * nothing changed. So checking for changes costs a few bytes, not the
 * whole shelf.
 *
 * no-store: the browser keeps no copy on disk. The app's own copy lives
 * in memory only, so a shared computer doesn't keep someone's shelf.
 */
export function revalidate() {
  const tag = etag();
  return async (c, next) => {
    await tag(c, next);
    c.res.headers.set("Cache-Control", "private, no-store");
  };
}
