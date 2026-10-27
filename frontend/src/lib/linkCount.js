/** "1 link", "3 links", "0 links" */
export function linkCount(count) {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? "link" : "links"}`;
}
