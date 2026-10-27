// The iframe code for showing a public link as a small card on another
// website (served by GET /h/:hash/embed).

export const EMBED_HEIGHT = 96;

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** The card's address; theme is "", "light" or "dark" */
export function embedUrl(publicUrl, theme = "") {
  return `${publicUrl}/embed${theme ? `?theme=${theme}` : ""}`;
}

/** The HTML to paste into another page */
export function embedSnippet(publicUrl, title, theme = "") {
  return `<iframe src="${escapeAttr(embedUrl(publicUrl, theme))}" title="${escapeAttr(title)}" width="100%" height="${EMBED_HEIGHT}" style="border:0;max-width:480px" loading="lazy"></iframe>`;
}
