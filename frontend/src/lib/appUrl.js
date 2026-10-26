/**
 * Old links look like /public/app/index.html#/login?share=x (the app used
 * hash routing). Turn those into the clean URL, here /login?share=x, so
 * bookmarks, sent share links and old login emails keep working.
 * Returns null when the URL is already clean.
 */
export function cleanUrlFromLegacyHash(location, base = "/") {
  const root = base.replace(/\/$/, "");
  if (location.hash.startsWith("#/")) return root + location.hash.slice(1);
  // The old app address without a route
  if (location.pathname?.endsWith("/public/app/index.html")) {
    return `${root}/dashboard`;
  }
  return null;
}

/** Absolute URL of an app route, e.g. appUrl("/login?share=x") */
export function appUrl(route, base = import.meta.env.BASE_URL) {
  return `${window.location.origin}${base.replace(/\/$/, "")}${route}`;
}
