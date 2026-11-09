/**
 * Utility / helper functions — mirrors the PHP helpers.php
 */

import crypto from "node:crypto";
import { isIP } from "node:net";
import { getConnInfo } from "@hono/node-server/conninfo";
import config from "../config.js";

/**
 * Generate a random alphanumeric hash for public links.
 */
export function generateHash(length = 10) {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let hash = "";
  for (let i = 0; i < length; i++) {
    hash += chars[crypto.randomInt(chars.length)];
  }
  return hash;
}

/**
 * Generate a secure hex token for magic links.
 */
export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Generate a 32-char hex share code.
 */
export function generateShareCode() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Strip HTML tags and trim whitespace (basic sanitisation).
 */
export function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim();
}

/**
 * Validate an email address (simple regex, matching PHP filter_var behaviour).
 */
export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// "192.168.1.10:8123" or "nas.lan" → http://; "example.com" → https://.
// Addresses on your own network rarely have certificates, the web does.
const SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
const LOCAL_HOST = /^(localhost|[\d.]+|\[[\da-f:]+\]|.+\.(local|lan|home|internal|home\.arpa))$/i;

/**
 * Add a scheme to an address typed without one, so "10.0.0.2:8080",
 * "nas:5000" and "example.com/page" can be saved. Anything with a scheme is left alone
 * (and still has to be http or https to pass validation).
 */
export function withScheme(value) {
  const text = String(value ?? "").trim();
  if (!text || SCHEME.test(text) || text.startsWith("//")) return text;
  const [hostPort] = text.split(/[/?#]/);
  const host = hostPort.replace(/:\d+$/, "");
  const hasPort = host !== hostPort;
  const local = LOCAL_HOST.test(host) || hasPort;
  // A bare word ("notes") is more likely a typo than a host; "nas:5000" isn't
  if (!local && !host.includes(".")) return text;
  return `${local ? "http" : "https"}://${text}`;
}

/**
 * Validate a URL — only allows http: and https: protocols.
 * Rejects javascript:, data:, vbscript:, and other dangerous schemes.
 */
export function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Check if a redirect origin is allowed (same host or known dev origins).
 * Prevents open redirect attacks via redirect_origin parameter.
 */
export function isAllowedRedirectOrigin(origin) {
  if (!origin || typeof origin !== "string") return false;

  try {
    const parsed = new URL(origin);
    const siteUrlParsed = new URL(config.siteUrl);

    // Allow same hostname (production)
    if (parsed.hostname === siteUrlParsed.hostname) return true;

    // Allow localhost origins (dev servers on different ports), but only in
    // development: in production a login link must never leave the site
    return isLocalHostname(parsed.hostname) && isDevSetup();
  } catch {
    return false;
  }
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * True when running locally (SITE_URL on localhost) or in debug mode.
 */
export function isDevSetup() {
  try {
    return config.debugMode || isLocalHostname(new URL(config.siteUrl).hostname);
  } catch {
    return config.debugMode;
  }
}

/**
 * Check whether a cross-origin request's Origin may use the API with cookies.
 * Returns the origin to echo back, or null to refuse.
 */
export function allowedCorsOrigin(origin) {
  if (!origin) return config.siteUrl;
  return isAllowedRedirectOrigin(origin) ? origin : null;
}

/**
 * Turn a stored return_to value into a same-site destination after login.
 * Accepts an app hash route ("#/edit") or a path on this site ("/h/abc").
 * Anything else ("@evil.com", "//evil.com", "https://...") falls back to
 * the dashboard, so the login link can't be used as an open redirect.
 */
export function safeReturnTo(returnTo) {
  if (typeof returnTo !== "string" || returnTo === "") return "#/dashboard";
  if (returnTo.startsWith("#")) return returnTo;
  if (
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !/[\\\x00-\x1f]/.test(returnTo)
  ) {
    return returnTo;
  }
  return "#/dashboard";
}

/**
 * Maximum input field lengths, so one account can't fill the disk or slow
 * the shelf down. Keep frontend/src/lib/limits.js in step (a test checks).
 *
 * URLs may be very long (tracking links, data in the query string): browsers
 * handle far more than the old 2048, so allow 64K characters.
 */
export const MAX_LENGTHS = {
  url: 65536,
  title: 255,
  description: 20000,
  icon: 100,
  color: 32,
  categoryName: 100,
  tagName: 50,
  tagsPerLink: 50,
  email: 254,
  returnTo: 2048,
  referer: 2048,
};

/** Largest API request body. A link at every limit is well under this. */
export const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Check a link's tag list: an array of strings, each within the tag
 * length, and not too many. Returns the cleaned names, or an error message.
 */
export function checkTagNames(tags) {
  if (tags == null) return { names: [] };
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string"))
    return { error: "Tags must be a list of names" };
  const names = [...new Set(tags.map(sanitize).filter(Boolean))];
  if (names.length > MAX_LENGTHS.tagsPerLink)
    return { error: `A link can have at most ${MAX_LENGTHS.tagsPerLink} tags` };
  const long = names.find((n) => n.length > MAX_LENGTHS.tagName);
  if (long)
    return {
      error: `Tag "${long.slice(0, 20)}…" is too long (at most ${MAX_LENGTHS.tagName} characters)`,
    };
  return { names };
}

/**
 * Return a JSON success response (same shape as PHP successResponse).
 */
export function successResponse(
  c,
  data = {},
  message = "Success",
  status = 200,
) {
  return c.json({ success: true, message, ...data }, status);
}

/**
 * Return a JSON error response (same shape as PHP errorResponse).
 */
export function errorResponse(c, message, status = 400) {
  return c.json({ error: message }, status);
}

/**
 * Mask an IP address for privacy.
 */
export function maskIpAddress(ip) {
  if (!ip) return "Unknown";
  // IPv4
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  // IPv6 — mask last half
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + ":xxxx:xxxx:xxxx:xxxx";
  }
  return "Unknown";
}

/**
 * Parse browser and OS from a User-Agent string.
 */
export function parseUserAgent(ua) {
  if (!ua) return { browser: "Unknown", os: "Unknown" };

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  else if (/MSIE|Trident\//i.test(ua)) browser = "Internet Explorer";

  let os = "Unknown";
  if (/iPhone/i.test(ua)) os = "iOS (iPhone)";
  else if (/iPad/i.test(ua)) os = "iOS (iPad)";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows NT 10/i.test(ua)) os = "Windows 10/11";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return { browser, os };
}

function isPrivateAddress(ip) {
  const v4 = ip.replace(/^::ffff:/, "");
  return (
    v4 === "::1" ||
    /^127\./.test(v4) ||
    /^10\./.test(v4) ||
    /^192\.168\./.test(v4) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v4) ||
    /^169\.254\./.test(v4) ||
    /^fe[89ab][0-9a-f]:/i.test(v4) ||
    /^f[cd][0-9a-f]{2}:/i.test(v4)
  );
}

function getSocketAddress(c) {
  try {
    return getConnInfo(c).remote.address || null;
  } catch {
    return null; // not running under @hono/node-server (e.g. tests)
  }
}

/** Accepts "1.2.3.4", "1.2.3.4:5678", "[::1]:80" and plain IPv6; null otherwise. */
function cleanIp(value) {
  let ip = String(value || "").trim();
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.replace(/:\d+$/, "");
  return isIP(ip) ? ip : null;
}

/**
 * The client in an X-Forwarded-For list. Each proxy adds the address it
 * got the request from to the END ("client-sent, …, real client, proxy"),
 * so the first entries are whatever the visitor chose to send. Reading
 * from the right and skipping our own proxies (private addresses) finds
 * the last address a trusted proxy saw. Only when every hop is private
 * (a visitor on the same network) is the first entry used.
 */
function clientFromForwardedFor(header) {
  const hops = String(header || "")
    .split(",")
    .map(cleanIp)
    .filter(Boolean);
  if (!hops.length) return null;
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!isPrivateAddress(hops[i])) return hops[i];
  }
  return hops[0];
}

/**
 * Get the client IP. Forwarding headers are only believed when they come
 * from a trusted proxy (see TRUST_PROXY), otherwise anyone could set
 * X-Forwarded-For to dodge the login rate limit or fake visit stats.
 *
 * CF-Connecting-IP is only read with TRUST_PROXY=true (a CDN in front):
 * a plain nginx passes that header on untouched, so in auto mode a
 * visitor could set it to anything.
 */
export function getClientIp(c) {
  const socketIp = getSocketAddress(c);
  const always = config.trustProxy === "true";
  const trustHeaders =
    always ||
    (config.trustProxy !== "false" &&
      (socketIp === null || isPrivateAddress(socketIp)));

  if (trustHeaders) {
    const forwarded =
      (always && cleanIp(c.req.header("cf-connecting-ip"))) ||
      clientFromForwardedFor(c.req.header("x-forwarded-for")) ||
      cleanIp(c.req.header("x-real-ip"));
    if (forwarded) return forwarded;
  }

  return socketIp || "127.0.0.1";
}

/**
 * Absolute URL of a destination after login. Accepts what safeReturnTo
 * returns: an app route in the old hash form ("#/edit") or a site path
 * ("/h/abc"). App routes are clean paths now: "#/edit" → {site}{base}/edit.
 * With a dev redirect origin (the Vite server) the app route goes there.
 */
export function returnToUrl(returnTo, redirectOrigin = null) {
  const route = returnTo.startsWith("#") ? returnTo.slice(1) : null;
  if (redirectOrigin) return `${redirectOrigin}${route || "/dashboard"}`;
  return route
    ? `${config.siteUrl}${baseUrl(route)}`
    : `${config.siteUrl}${returnTo}`;
}

/**
 * Share previews (Facebook, Slack, iMessage…) only load an absolute
 * og:image URL, and the page doesn't know its public address at build
 * time. Point og:image and twitter:image at SITE_URL.
 */
export function withAbsoluteShareImage(html) {
  return html.replace(
    /(<meta [^>]*(?:property="og:image"|name="twitter:image")[^>]*content=")[^"]*\/(og-image\.png)(")/g,
    (_, start, file, end) => `${start}${config.siteUrl}${baseUrl(`/${file}`)}${end}`,
  );
}

/**
 * Construct a URL with the configured base path.
 */
export function baseUrl(pathStr = "") {
  const base = (config?.basePath || "").replace(/\/$/, "");
  const p = pathStr.startsWith("/") ? pathStr : `/${pathStr}`;
  return base + p;
}
