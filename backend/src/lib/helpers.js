/**
 * Utility / helper functions — mirrors the PHP helpers.php
 */

import crypto from "node:crypto";
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

/** Maximum input field lengths to prevent storage abuse */
export const MAX_LENGTHS = {
  url: 2048,
  title: 255,
  description: 5000,
  icon: 100,
  categoryName: 100,
  tagName: 50,
  email: 254,
};

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

/**
 * Get the client IP. Forwarding headers are only believed when they come
 * from a trusted proxy (see TRUST_PROXY), otherwise anyone could set
 * X-Forwarded-For to dodge the login rate limit or fake visit stats.
 */
export function getClientIp(c) {
  const socketIp = getSocketAddress(c);
  const trustHeaders =
    config.trustProxy === "true" ||
    (config.trustProxy !== "false" &&
      (socketIp === null || isPrivateAddress(socketIp)));

  if (trustHeaders) {
    const forwarded =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip");
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
 * Construct a URL with the configured base path.
 */
export function baseUrl(pathStr = "") {
  const base = (config?.basePath || "").replace(/\/$/, "");
  const p = pathStr.startsWith("/") ? pathStr : `/${pathStr}`;
  return base + p;
}
