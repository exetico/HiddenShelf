// What the server accepts (backend/src/lib/helpers.js MAX_LENGTHS; a
// backend test keeps the two in step). Checked in the forms so a too-long
// field gets a clear message before saving, instead of a refused request.

export const LIMITS = {
  url: 65_536,
  title: 255,
  description: 20_000,
  icon: 100,
  categoryName: 100,
  tagName: 50,
  tagsPerLink: 50,
};

const LABELS = {
  url: "The URL",
  title: "The title",
  description: "The description",
  icon: "The icon name",
  categoryName: "The category name",
  tagName: "A tag",
};

/** "The title is 12 characters too long (at most 255)." or null. */
export function tooLongMessage(key, value) {
  const over = String(value ?? "").trim().length - LIMITS[key];
  if (over <= 0) return null;
  const n = over.toLocaleString("en");
  return `${LABELS[key]} is ${n} character${over === 1 ? "" : "s"} too long (at most ${LIMITS[key].toLocaleString("en")}).`;
}

/** Problems with a link form's fields, as messages to show. */
export function linkFormProblems({ url, title, description, icon, tags = [] }) {
  const problems = [
    tooLongMessage("url", url),
    tooLongMessage("title", title),
    tooLongMessage("description", description),
    tooLongMessage("icon", icon),
  ];
  const longTag = tags.find((tag) => tag.length > LIMITS.tagName);
  if (longTag)
    problems.push(`The tag "${longTag.slice(0, 20)}…" is too long (at most ${LIMITS.tagName} characters).`);
  if (tags.length > LIMITS.tagsPerLink)
    problems.push(`A link can have at most ${LIMITS.tagsPerLink} tags.`);
  return problems.filter(Boolean);
}
