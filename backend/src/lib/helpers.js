/**
 * Utility / helper functions — mirrors the PHP helpers.php
 */

import crypto from "node:crypto";
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

    // Allow localhost origins (dev servers on different ports)
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return true;
    }

    return false;
  } catch {
    return false;
  }
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

/**
 * Get real client IP from common headers.
 */
export function getClientIp(c) {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "127.0.0.1"
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
