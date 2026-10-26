/**
 * A deliberately small Markdown renderer for link descriptions.
 *
 * Supports: **bold**, *italic* / _italic_, ~~strike~~, `code`,
 * [text](https://…) links, bare https:// links, "- " / "* " bullet lists,
 * "1. " numbered lists and line breaks. No images, no HTML: everything is
 * escaped first, and links must be http(s) or mailto.
 */

const escapeHtml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function link(href, label) {
  // href arrives HTML-escaped already; only &amp; needs to stay that way
  const raw = href.replace(/&amp;/g, "&");
  if (!SAFE_URL.test(raw)) return label;
  return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
}

function inline(text) {
  // Code spans first, so their content isn't formatted
  const codes = [];
  let out = text.replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label, href) => link(href, label))
    .replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g,
      (_, before, url) => `${before}${link(url, url)}`,
    )
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function renderMarkdown(source) {
  if (!source) return "";
  const lines = escapeHtml(String(source)).replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let list = null; // "ul" | "ol"
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const item = bullet || numbered;
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (item) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      if (list !== type) {
        closeList();
        html.push(`<${type}>`);
        list = type;
      }
      html.push(`<li>${inline(item[1])}</li>`);
    } else if (!line.trim()) {
      flushParagraph();
      closeList();
    } else if (heading) {
      // Kept small: # is h3, ## is h4, ### and deeper are h5
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length + 2, 5);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else {
      closeList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  closeList();
  return html.join("");
}

/** The text without Markdown marks, for tooltips and previews */
export function markdownToText(source) {
  if (!source) return "";
  return String(source)
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|$)/g, "$1$2")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "• ")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}
