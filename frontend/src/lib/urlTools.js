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

// The Tools page's tools, in the order the page shows them. `group` puts
// a tool under one of TOOL_GROUPS. All of them run in the browser: the
// server is only asked to save what you choose to save. The dashboard
// links to each one.
export const TOOLS = [
  {
    key: "duplicates",
    group: "shelf",
    label: "Duplicates",
    icon: "mdi-content-duplicate",
    accent: "amber",
    hint: "Find links you saved more than once",
    description:
      "Finds links that point to the same page, even when one has https, www. or tracking the other doesn't. Keep the one you want and move the rest to the trash.",
  },
  {
    key: "tidy",
    group: "shelf",
    label: "Tidy up",
    icon: "mdi-broom",
    accent: "emerald",
    hint: "Links without a category or tags, and tracking to remove",
    description:
      "Lists links that would be easier to find with a little care: no category, no tags, a title that's just the address, or tracking in the address. Fix them one by one, or clean all tracking at once.",
  },
  {
    key: "stats",
    group: "shelf",
    label: "Shelf stats",
    icon: "mdi-chart-box-outline",
    accent: "sky",
    hint: "Links per month, top sites, links you never open",
    description:
      "How your shelf grows month by month, the sites you save the most from, the links you open most and the ones you never open. Worked out in your browser from your own links.",
  },
  {
    key: "add-many",
    group: "move",
    label: "Add many links",
    icon: "mdi-playlist-plus",
    accent: "violet",
    hint: "Paste a list of links and add them all at once",
    description:
      "Paste links from anywhere: a list, an email, a chat or your browser's open tabs. Hidden Shelf picks out the addresses, skips the ones you already have, and adds the rest to the category you choose.",
  },
  {
    key: "bookmarks",
    group: "move",
    label: "Browser bookmarks",
    icon: "mdi-bookmark-multiple-outline",
    accent: "sky",
    hint: "Bring in your browser's bookmarks, or make a file for it",
    description:
      "Import the bookmarks file that Chrome, Firefox, Safari or Edge exports: folders become categories and links you already have are skipped. Or save your shelf as a bookmarks file to import into a browser.",
  },
  {
    key: "share-list",
    group: "move",
    label: "Copy as a list",
    icon: "mdi-format-list-bulleted-square",
    accent: "orange",
    hint: "A category or tag as Markdown, text or HTML to paste anywhere",
    description:
      "Turn a category, a tag or your favorites into a list to paste into a chat, a note, an email or a README. Pick Markdown, plain text, HTML or CSV, then copy it or save it as a file.",
  },
  {
    key: "qr",
    group: "link",
    label: "QR code",
    icon: "mdi-qrcode",
    accent: "rose",
    hint: "A QR code for an address, text or your Wi-Fi",
    description:
      "Make a QR code for any address or text, or one that joins your Wi-Fi, to show on screen or print and stick on the fridge. Save it as a picture.",
  },
  {
    key: "inspect",
    group: "link",
    label: "Inspect a link",
    icon: "mdi-magnify-scan",
    accent: "slate",
    hint: "See what's in an address, and strip its tracking",
    description:
      "Breaks an address into its parts, shows each query parameter decoded, and flags the ones that only track you. Copy a clean version, or decode and encode text for an address.",
  },
];

export const TOOL_GROUPS = [
  { key: "shelf", label: "Look after your shelf" },
  { key: "move", label: "Bring links in, send them out" },
  { key: "link", label: "Work with a link" },
];

// Tools that were merged into another; old links to them still work
const RENAMED = { encode: "inspect", clean: "inspect" };

/** The tool for a ?tool= value, or null for the overview */
export function toolFor(key) {
  const wanted = RENAMED[key] || key;
  return TOOLS.find((t) => t.key === wanted) || null;
}

/** The tools page's query for one tool; no key is the overview */
export function toolQuery(key) {
  return key ? { tool: key } : {};
}

/** href for one tool (or the overview), under BASE_PATH */
export function toolHref(key, base = import.meta.env.BASE_URL) {
  const params = new URLSearchParams(toolQuery(key)).toString();
  return `${base.replace(/\/$/, "")}/tools${params ? `?${params}` : ""}`;
}
