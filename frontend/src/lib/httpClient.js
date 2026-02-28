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

  const response = await fetch(fullPath, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
    // Body is already a string (callers use JSON.stringify) so pass as-is
    body: options.body || undefined,
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
