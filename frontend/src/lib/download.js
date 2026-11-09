// Saving text the app made (a bookmarks file, a list) as a file. A blob:
// URL works in every browser, Safari included; data: links don't on iPhone.

export function downloadText(text, fileName, type = "text/plain") {
  const href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari reads the blob after click() returns, so give it a moment
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
}
