// The shelf tools on the Tools page (duplicates, tidy up, add many). They
// work on the shelf the app has already loaded, in the browser.

import { LIMITS } from "@/lib/limits";
import { withScheme } from "@/lib/url";
import { cleanTracking, isTrackingParam, parseUrl } from "@/lib/urlTools";

/** Links you own; shared categories' links are someone else's to tidy */
export const ownLinks = (links) => links.filter((l) => !l.is_from_shared_category);

/**
 * The same comparison as the server's duplicate check (normalizeUrl in
 * backend/src/routes/links.js): ignores http/https, "www.", host case, a
 * trailing slash and the #fragment. Tracking parameters are ignored too, so
 * a link saved from a newsletter matches the plain one.
 */
export function sameUrlKey(value) {
  const cleaned = cleanTracking(value);
  if (!cleaned) return null;
  const url = new URL(cleaned.url);
  const host = url.host.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${path}${url.search}`;
}

/**
 * Groups of your links that point at the same page, biggest first. In each
 * group the oldest link comes first: that's the one to keep.
 */
export function findDuplicates(links) {
  const groups = new Map();
  for (const link of ownLinks(links)) {
    const key = sameUrlKey(link.url);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(link);
  }
  const byAge = (a, b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || a.id - b.id;
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, links: [...group].sort(byAge) }))
    .sort((a, b) => b.links.length - a.links.length || a.key.localeCompare(b.key));
}

/** True if the address carries tracking parameters (utm_source, fbclid …) */
export function hasTracking(url) {
  const parsed = parseUrl(url);
  return Boolean(parsed && [...parsed.searchParams.keys()].some(isTrackingParam));
}

/** True when the title says nothing the address doesn't: empty, or the address itself */
export function plainTitle(link) {
  const title = String(link.title ?? "").trim().toLowerCase().replace(/\/+$/, "");
  if (!title) return true;
  const url = parseUrl(link.url);
  if (!url) return false;
  const bare = (s) => s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  return [url.href, url.host].some((v) => bare(v.toLowerCase()) === bare(title));
}

// The tidy-up checks: what each finds, and the words for it
export const TIDY_CHECKS = [
  {
    key: "uncategorized",
    label: "No category",
    icon: "mdi-folder-off-outline",
    hint: "Links that aren't in a category, so they only show under Uncategorized.",
    test: (link) => link.category_id == null,
  },
  {
    key: "untagged",
    label: "No tags",
    icon: "mdi-tag-off-outline",
    hint: "Links without tags. Tags make links easy to find across categories.",
    test: (link) => !(link.tags || []).length,
  },
  {
    key: "tracking",
    label: "Tracking in the address",
    icon: "mdi-eye-off-outline",
    hint: "Addresses with tracking like utm_source or fbclid. They work without it.",
    test: (link) => hasTracking(link.url),
  },
  {
    key: "plain-title",
    label: "Title is just the address",
    icon: "mdi-format-title",
    hint: "Links whose title is the address itself. A real name is easier to scan.",
    test: plainTitle,
  },
];

/** Your links each tidy-up check finds, by check key */
export function tidyReport(links) {
  const own = ownLinks(links);
  return Object.fromEntries(TIDY_CHECKS.map((check) => [check.key, own.filter(check.test)]));
}

// A bare "example.com/x" needs a real top-level domain, so "e.g." and
// "i.e." in pasted text aren't taken for addresses
const BARE_HOST = /^(localhost|(\d{1,3}\.){3}\d{1,3}|([a-z0-9-]+\.)+[a-z]{2,})(:\d+)?$/i;

/**
 * The web addresses in some pasted text: one per line, a list from an
 * email, or links mixed into prose. In order, without repeats.
 */
export function extractUrls(text) {
  const found = [];
  const seen = new Set();
  for (const raw of String(text ?? "").split(/[\s<>"']+/)) {
    const token = raw.replace(/^[([{]+/, "").replace(/[.,;:!?)\]}]+$/, "");
    if (!token) continue;
    const hasScheme = /^https?:\/\//i.test(token);
    if (!hasScheme && !BARE_HOST.test(token.split(/[/?#]/)[0])) continue;
    const url = parseUrl(hasScheme ? token : withScheme(token));
    if (!url || !/^https?:$/.test(url.protocol)) continue;
    const key = sameUrlKey(url.href) ?? url.href;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(url.href);
  }
  return found;
}

// "my-great_post.html" → "My great post"
function wordsFrom(segment) {
  let text = segment;
  try {
    text = decodeURIComponent(segment);
  } catch {
    // keep it as it is
  }
  text = text.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[-_+]+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/**
 * A readable title for an address saved without one:
 * "https://blog.example.com/2024/my-post/" → "My post · blog.example.com"
 */
export function titleFromUrl(value) {
  const url = parseUrl(value);
  if (!url) return String(value ?? "").slice(0, LIMITS.title);
  const host = url.host.replace(/^www\./, "");
  const segment = url.pathname
    .split("/")
    .filter((s) => s && !/^\d+$/.test(s))
    .pop();
  const words = segment ? wordsFrom(segment) : "";
  const title = words ? `${words} · ${host}` : host;
  return title.slice(0, LIMITS.title);
}
