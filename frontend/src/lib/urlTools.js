// Small link tools that run in the browser only: nothing here is sent to
// the server.

import { withScheme } from "@/lib/url";

// Query parameters that only track where a click came from. utm_* is
// matched by prefix; the rest by exact name.
const TRACKING_PREFIXES = ["utm_", "pk_", "mtm_"];
const TRACKING_NAMES = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "yclid",
  "twclid",
  "ttclid",
  "li_fat_id",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "mkt_tok",
  "vero_id",
  "oly_anon_id",
  "oly_enc_id",
  "rb_clickid",
  "s_cid",
  "ref_src",
  "ref_url",
]);

export function isTrackingParam(name) {
  const key = name.toLowerCase();
  return TRACKING_NAMES.has(key) || TRACKING_PREFIXES.some((p) => key.startsWith(p));
}

/** A URL object for what was typed, or null. "example.com/x" works too. */
export function parseUrl(text) {
  const value = withScheme(text);
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * The address without tracking parameters, and the names it took off.
 * Returns null when it isn't a web address.
 */
export function cleanTracking(text) {
  const url = parseUrl(text);
  if (!url) return null;
  const removed = [];
  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParam(name) && !removed.includes(name)) {
      removed.push(name);
      url.searchParams.delete(name);
    }
  }
  return { url: url.href, removed };
}

/** The parts of an address, for the "Inspect" tool. */
export function urlParts(text) {
  const url = parseUrl(text);
  if (!url) return null;
  return {
    protocol: url.protocol.replace(/:$/, ""),
    host: url.hostname,
    port: url.port,
    path: decodeSafe(url.pathname),
    hash: decodeSafe(url.hash.replace(/^#/, "")),
    params: [...url.searchParams.entries()].map(([name, value]) => ({
      name,
      value,
      tracking: isTrackingParam(name),
    })),
  };
}

function decodeSafe(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Percent-encodes text. "component" encodes everything that isn't safe
 * inside one query value; "url" keeps the characters that give an address
 * its shape (: / ? # & =).
 */
export function encodeText(text, mode = "component") {
  return mode === "url" ? encodeURI(text) : encodeURIComponent(text);
}

/** Decodes percent-encoding, and "+" as a space. Throws on broken input. */
export function decodeText(text) {
  return decodeURIComponent(text.replace(/\+/g, " "));
}

// QR codes for long addresses get dense and hard to scan from a distance
export const LONG_QR_URL = 80;

// The tools page's tools; the dashboard links to each one
export const TOOLS = [
  { key: "qr", label: "QR code", icon: "mdi-qrcode", hint: "Turn an address into a QR code" },
  { key: "encode", label: "Encode / decode", icon: "mdi-code-braces", hint: "Percent-encode text, or decode it" },
  { key: "clean", label: "Clean link", icon: "mdi-broom", hint: "Take tracking (utm_, fbclid …) off an address" },
  { key: "inspect", label: "Inspect link", icon: "mdi-magnify-scan", hint: "See an address's parts and query parameters" },
];

/** The tools page's query for one tool; the first tool needs none */
export function toolQuery(key) {
  return key === TOOLS[0].key ? {} : { tool: key };
}

/** href for one tool, under BASE_PATH */
export function toolHref(key, base = import.meta.env.BASE_URL) {
  const params = new URLSearchParams(toolQuery(key)).toString();
  return `${base.replace(/\/$/, "")}/tools${params ? `?${params}` : ""}`;
}
