// Shelf stats, worked out in the browser from the shelf the app already has.
// Only your own links count (not those in categories shared with you).
// created_at and last_opened_at are UTC, "YYYY-MM-DD HH:MM:SS".

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ownLinks = (links) => links.filter((l) => !l.is_from_shared_category);

function toDate(value) {
  if (!value) return null;
  const text = String(value);
  const date = new Date(text.includes("T") ? text : `${text.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Links added in each of the last `months` months, oldest first:
 * [{ key: "2026-11", label: "Nov", year: 2026, count }]
 */
export function addedPerMonth(links, now = new Date(), months = 12) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, label: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear(), count: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const link of links) {
    const key = String(link.created_at || "").slice(0, 7);
    const bucket = byKey.get(key);
    if (bucket) bucket.count++;
  }
  return buckets;
}

/** The site of an address, without www. */
export function siteOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Sites you saved the most links from: [{ site, count }] */
export function topSites(links, limit = 10) {
  const counts = new Map();
  for (const link of links) {
    const site = siteOf(link.url);
    if (site) counts.set(site, (counts.get(site) || 0) + 1);
  }
  return [...counts]
    .map(([site, count]) => ({ site, count }))
    .sort((a, b) => b.count - a.count || a.site.localeCompare(b.site))
    .slice(0, limit);
}

/**
 * Links you haven't opened from the app, saved at least `minDays` days ago
 * (so new ones get a chance), oldest first.
 */
export function neverOpened(links, now = new Date(), minDays = 30) {
  const cutoff = now.getTime() - minDays * 86_400_000;
  return links
    .filter((link) => !link.open_count)
    .filter((link) => {
      const added = toDate(link.created_at);
      return added && added.getTime() <= cutoff;
    })
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

/** The links you open most: [{ link, count }] */
export function mostOpened(links, limit = 5) {
  return links
    .filter((link) => link.open_count > 0)
    .sort((a, b) => b.open_count - a.open_count || String(b.last_opened_at).localeCompare(String(a.last_opened_at)))
    .slice(0, limit);
}

/** Headline numbers */
export function shelfTotals(links, now = new Date()) {
  const monthAgo = now.getTime() - 30 * 86_400_000;
  return {
    links: links.length,
    addedLast30: links.filter((l) => (toDate(l.created_at)?.getTime() ?? 0) >= monthAgo).length,
    toRead: links.filter((l) => l.read_later).length,
    public: links.filter((l) => l.is_public).length,
    opened: links.filter((l) => l.open_count > 0).length,
  };
}
