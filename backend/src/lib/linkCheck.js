/**
 * Link checker: asks a link's site whether the page is still there, for
 * the "Check links" tool (POST /api/links/check).
 *
 * The server makes these requests, so they must never reach the server's
 * own network. Every address a host name resolves to is checked before
 * connecting (in the socket's own DNS lookup, so a name can't change its
 * answer between the check and the connection), and again on every
 * redirect. Links to private, loopback and link-local addresses are
 * skipped, not checked. Only the status line is read; bodies are dropped.
 */

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Mozilla/5.0 (compatible; HiddenShelf link checker)";

// Addresses a check must never connect to
const blocked = new net.BlockList();
for (const [prefix, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
])
  blocked.addSubnet(prefix, bits, "ipv4");
for (const [prefix, bits] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["64:ff9b::", 96],
  ["2001:db8::", 32],
])
  blocked.addSubnet(prefix, bits, "ipv6");

/** True for an address on a private, local or reserved network */
export function isPrivateAddress(address) {
  const ip = String(address || "").replace(/^\[|\]$/g, "");
  const family = net.isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) {
    // ::ffff:10.0.0.1 is an IPv4 address in IPv6 clothing
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return blocked.check(mapped[1], "ipv4");
    return blocked.check(ip, "ipv6");
  }
  return true; // not an address at all: don't connect
}

class PrivateAddressError extends Error {
  constructor() {
    super("private address");
    this.code = "EPRIVATE";
  }
}

// dns.lookup, refusing names that resolve to a private address
function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address)))
      return callback(new PrivateAddressError());
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

/**
 * One request; resolves { status, location } from the status line. The
 * body is never read.
 */
function probe(url, method) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method,
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      },
      (res) => {
        resolve({ status: res.statusCode, location: res.headers.location || null });
        res.destroy();
      },
    );
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    req.end();
  });
}

// Plain words for what went wrong
function describeError(error) {
  switch (error?.code) {
    case "ENOTFOUND":
      return { status: "broken", reason: "The site's name no longer exists" };
    case "ECONNREFUSED":
      return { status: "broken", reason: "The site refused the connection" };
    case "EPRIVATE":
      return { status: "skipped", reason: "On a private network, so it isn't checked from the server" };
    case "ETIMEDOUT":
      return { status: "unsure", reason: "The site took too long to answer" };
    case "EAI_AGAIN":
      return { status: "unsure", reason: "Couldn't look up the site's name right now" };
    default:
      if (/CERT|SSL|TLS/i.test(error?.code || ""))
        return { status: "unsure", reason: "The site's security certificate has a problem" };
      return { status: "unsure", reason: "Couldn't reach the site" };
  }
}

/** What a final status code means for the person who saved the link */
export function describeStatus(code) {
  if (code >= 200 && code < 300) return { status: "ok", reason: "" };
  if (code === 404 || code === 410) return { status: "broken", reason: `The page is gone (${code})` };
  if (code === 401 || code === 403)
    return { status: "unsure", reason: `The site needs a sign-in or blocked the check (${code})` };
  if (code === 429) return { status: "unsure", reason: "The site asked us to slow down (429)" };
  if (code >= 500) return { status: "unsure", reason: `The site had an error (${code})` };
  if (code >= 300 && code < 400) return { status: "unsure", reason: `Redirected without an address (${code})` };
  return { status: "unsure", reason: `The site answered ${code}` };
}

/**
 * Checks one address. Resolves to:
 *   { status: "ok" | "moved" | "broken" | "unsure" | "skipped",
 *     code, reason, final_url }
 * "moved" means the site says the page has a new address for good
 * (301/308 all the way), so the link could be updated to final_url.
 * `request` is the probe, swappable in tests.
 */
export async function checkUrl(address, { request = probe } = {}) {
  let url;
  try {
    url = new URL(address);
  } catch {
    return { status: "skipped", code: null, reason: "Not a web address", final_url: null };
  }

  let permanent = true;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return { status: "skipped", code: null, reason: "Not a web address", final_url: null };
    // Literal IPs skip the DNS lookup, so they're checked here
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname))
      return { status: "skipped", code: null, ...describeError({ code: "EPRIVATE" }), final_url: null };

    let answer;
    try {
      answer = await request(url, "HEAD");
      // Some sites don't do HEAD; ask for the page instead
      if ([400, 403, 405, 501].includes(answer.status)) answer = await request(url, "GET");
    } catch (error) {
      return { code: null, final_url: null, ...describeError(error) };
    }

    const { status: code, location } = answer;
    if (code >= 300 && code < 400 && location) {
      if (code !== 301 && code !== 308) permanent = false;
      try {
        url = new URL(location, url);
      } catch {
        return { status: "unsure", code, reason: "Redirected to a broken address", final_url: null };
      }
      continue;
    }

    const result = { code, final_url: hop ? url.href : null, ...describeStatus(code) };
    if (result.status === "ok" && hop && permanent && url.href !== address)
      return { ...result, status: "moved", reason: "The page has a new address" };
    return result;
  }
  return { status: "unsure", code: null, reason: "Too many redirects", final_url: null };
}

/** Runs `worker` over `items`, `limit` at a time, keeping their order */
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
