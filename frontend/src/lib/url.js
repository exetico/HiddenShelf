// Kept the same as withScheme in backend/src/lib/helpers.js, which the
// server applies too; doing it here as well shows people what gets saved.

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
