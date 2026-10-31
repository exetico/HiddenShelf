/**
 * Construct full URL with base path
 * In dev: Vite proxy handles /api -> backend
 * In prod: Need to prepend base path to API calls
 */
function getFullPath(path) {
  // If it's already an absolute URL, return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // In production builds, BASE_URL contains the subpath (from vite.config.js base)
  const basePath = import.meta.env.BASE_URL || "/";

  // Remove trailing slash from basePath and leading slash from path
  const normalizedBase = basePath.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return normalizedBase + normalizedPath;
}

export async function request(path, options = {}) {
  const fullPath = getFullPath(path);

  const { headers, body, ...rest } = options;
  const response = await fetch(fullPath, {
    credentials: "same-origin",
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    // Body is already a string (callers use JSON.stringify) so pass as-is
    body: body || undefined,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Invalid server response");
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  return payload;
}

// The last answer to each revalidated() GET, with its ETag. Memory only:
// nothing is written to the browser's storage or disk cache, and a reload
// (signing out does one) forgets it.
const lastAnswers = new Map();

/**
 * A GET for a list the app keeps whole (the shelf). Sends the ETag of the
 * last answer; when nothing changed the server says 304 with no body and
 * this returns the last answer again. The server marks these no-store, so
 * the browser keeps no copy of its own.
 */
export async function revalidated(path) {
  const last = lastAnswers.get(path);
  const response = await fetchWithTag(path, last?.etag);
  if (response.notModified && last) return last.payload;
  if (response.notModified) return fetchWithTag(path).then((r) => r.payload);
  if (response.etag) lastAnswers.set(path, { etag: response.etag, payload: response.payload });
  return response.payload;
}

async function fetchWithTag(path, etag) {
  const response = await fetch(getFullPath(path), {
    credentials: "same-origin",
    cache: "no-store",
    headers: etag ? { "If-None-Match": etag } : {},
  });
  if (response.status === 304) return { notModified: true };
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Invalid server response");
  }
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return { payload, etag: response.headers?.get?.("ETag") || null };
}

/** For tests: forget the remembered answers */
export function forgetAnswers() {
  lastAnswers.clear();
}
