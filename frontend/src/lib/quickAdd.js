// "Save to Hidden Shelf" from other pages: the bookmarklet (and anything
// else) opens /edit?new=1&url=…&title=…, and the form opens filled in.

const HTTP_URL = /https?:\/\/[^\s<>"']+/i;

/**
 * The link to prefill from a route query, or null. Accepts `url`, or the
 * first web address inside `text` (what phone share sheets often send).
 */
export function quickAddFromQuery(query = {}) {
  const pick = (value) => (Array.isArray(value) ? value[0] : value) || "";
  const text = pick(query.text).trim();
  let url = pick(query.url).trim();
  if (!/^https?:\/\//i.test(url)) url = text.match(HTTP_URL)?.[0] || "";
  if (!url) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  const title = (pick(query.title) || text.replace(url, "")).trim().slice(0, 200);
  return { url, title };
}

/**
 * A bookmarklet that opens this app's add form for the page you're on.
 * `addUrl` is the absolute address of /edit?new=1 on this server.
 */
export function bookmarkletHref(addUrl) {
  const target = JSON.stringify(addUrl);
  return (
    "javascript:(function(){window.open(" +
    target +
    "+'&url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank','noopener')})()"
  );
}
