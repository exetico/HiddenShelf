// Saving a generated picture (a QR code) as a file.
//
// A plain <a href="data:…" download> does nothing useful on Safari for
// iPhone and iPad: it offers "View" or "Download" and neither saves the
// picture. So on phones and tablets that can share files, the picture goes
// to the share sheet, which has "Save Image" (and Photos, AirDrop …).
// Everywhere else it downloads from a blob: URL, which Safari on the Mac
// handles too.

/** A Blob for a data: URL, without a network request */
export function dataUrlToBlob(dataUrl) {
  const [head, body = ""] = String(dataUrl).split(",");
  const type = head.match(/^data:([^;,]+)/)?.[1] || "application/octet-stream";
  if (/;base64/.test(head)) {
    const bytes = atob(body);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
    return new Blob([array], { type });
  }
  return new Blob([decodeURIComponent(body)], { type });
}

// Touch screens without a mouse: phones and tablets
function isTouchDevice() {
  try {
    return window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches;
  } catch {
    return false;
  }
}

/**
 * Saves the picture. Resolves "shared" (share sheet), "downloaded", or
 * "cancelled" when the share sheet was closed without picking anything.
 */
export async function saveImage(dataUrl, fileName) {
  const blob = dataUrlToBlob(dataUrl);
  if (isTouchDevice() && typeof File === "function" && navigator.canShare) {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return "shared";
      } catch (error) {
        if (error?.name === "AbortError") return "cancelled";
        // Share refused (not allowed here, say): fall back to a download
      }
    }
  }
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari reads the blob after click() returns, so give it a moment
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
  return "downloaded";
}
