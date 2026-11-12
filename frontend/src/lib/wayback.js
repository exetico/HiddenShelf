// Internet Archive (Wayback Machine) addresses for a link. Nothing is
// fetched here or on the server: the app only opens these in a new tab,
// and the browser talks to web.archive.org.

const ARCHIVE = "https://web.archive.org";

/** The address without its #fragment, or "" when it isn't http(s) */
function archivable(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    return parsed.href;
  } catch {
    return "";
  }
}

/** Opens the newest copy the Archive has (or says it has none) */
export function archivedCopyUrl(url) {
  const target = archivable(url);
  return target ? `${ARCHIVE}/web/${target}` : "";
}

/** Asks the Archive to save a copy now; the page shows its progress */
export function saveCopyUrl(url) {
  const target = archivable(url);
  return target ? `${ARCHIVE}/save/${target}` : "";
}
