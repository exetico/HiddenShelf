// Words for a category share link: who it works for and when it ends.
// Every link ends 7 days after it was made (see backend routes/shares.js).

export const SHARE_MODES = [
  { key: "once", label: "One person", hint: "Works once. When someone joins, a new link shows up here for the next person." },
  { key: "week", label: "Anyone for 7 days", hint: "Anyone with the link can join until it ends." },
];

/** Whole days left, rounded up; 0 once it has ended. */
export function daysLeft(expiresAt, now = Date.now()) {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - now;
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

/** Has this share link ended? A link with no end date counts as ended. */
export function shareEnded(share, now = Date.now()) {
  if (!share) return true;
  if (share.expired) return true;
  return daysLeft(share.expires_at, now) === 0;
}

/** "Works for one person · ends in 5 days", or "This link has ended". */
export function shareStatus(share, now = Date.now()) {
  if (shareEnded(share, now)) return "This link has ended. Make a new one to share again.";
  const who = share.mode === "week" ? "Anyone with it can join" : "Works for one person";
  const left = daysLeft(share.expires_at, now);
  return `${who} · ends ${left === 1 ? "within a day" : `in ${left} days`}`;
}
