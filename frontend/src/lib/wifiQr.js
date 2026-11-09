// The text in a "join this Wi-Fi" QR code. Phone cameras (iPhone and
// Android) offer to join the network when they scan it.

export const WIFI_SECURITY = [
  { value: "WPA", label: "WPA / WPA2 / WPA3" },
  { value: "WEP", label: "WEP (old)" },
  { value: "nopass", label: "No password" },
];

// \ ; , : and " have to be escaped with a backslash
const escape = (text) => String(text ?? "").replace(/([\\;,:"])/g, "\\$1");

/** WIFI:T:WPA;S:name;P:password;; or "" without a network name */
export function wifiPayload({ ssid = "", password = "", security = "WPA", hidden = false } = {}) {
  if (!ssid) return "";
  const parts = [`T:${security}`, `S:${escape(ssid)}`];
  if (security !== "nopass") parts.push(`P:${escape(password)}`);
  if (hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}
