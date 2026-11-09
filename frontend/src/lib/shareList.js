// "Copy as a list": some links as text to paste somewhere else.

export const LIST_FORMATS = [
  { value: "markdown", label: "Markdown", hint: "For notes, chats and READMEs", ext: "md", type: "text/markdown" },
  { value: "text", label: "Plain text", hint: "Titles and addresses, for anywhere", ext: "txt", type: "text/plain" },
  { value: "html", label: "HTML", hint: "Clickable links for emails and web pages", ext: "html", type: "text/html" },
  { value: "csv", label: "CSV", hint: "For a spreadsheet", ext: "csv", type: "text/csv" },
];

const escapeHtml = (text) =>
  String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// [ and ] would end a Markdown link's text early
const escapeMarkdown = (text) => String(text ?? "").replace(/([\\[\]])/g, "\\$1");
const markdownUrl = (url) =>
  String(url).replace(/[()\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
const oneLine = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const csvCell = (text) => {
  const value = String(text ?? "");
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

/**
 * The links as `format` (one of LIST_FORMATS). `heading` goes on top;
 * `descriptions` adds each link's description (first line only).
 */
export function formatList(links, format, { heading = "", descriptions = false } = {}) {
  const note = (link) => (descriptions ? oneLine(link.description) : "");
  switch (format) {
    case "csv":
      return [
        "title,url,description,tags",
        ...links.map((l) =>
          [l.title, l.url, oneLine(l.description), (l.tags || []).map((t) => t.name).join(", ")]
            .map(csvCell)
            .join(","),
        ),
      ].join("\n");
    case "html": {
      const items = links.map((l) => {
        const text = note(l);
        return `  <li><a href="${escapeHtml(l.url)}">${escapeHtml(l.title)}</a>${text ? ` – ${escapeHtml(text)}` : ""}</li>`;
      });
      return [heading && `<h2>${escapeHtml(heading)}</h2>`, "<ul>", ...items, "</ul>"].filter(Boolean).join("\n");
    }
    case "text":
      return [
        heading && `${heading}\n`,
        ...links.map((l) => [l.title, note(l), l.url].filter(Boolean).join("\n")),
      ]
        .filter(Boolean)
        .join("\n\n");
    default: {
      const items = links.map((l) => {
        const text = note(l);
        return `- [${escapeMarkdown(oneLine(l.title))}](${markdownUrl(l.url)})${text ? ` – ${text}` : ""}`;
      });
      return [heading && `## ${heading}\n`, ...items].filter(Boolean).join("\n");
    }
  }
}
