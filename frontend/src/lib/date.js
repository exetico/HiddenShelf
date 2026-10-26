/**
 * Short date for "Added …", like "3 Oct 2025". The server stores times as
 * "YYYY-MM-DD HH:MM:SS" in UTC.
 */
export function formatDate(value) {
  if (!value) return "";
  const iso = String(value).replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
