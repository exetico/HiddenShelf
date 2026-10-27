// Share previews and home screen icons: the files the pages point at exist
// and have the sizes they claim (a 51px favicon used to stand in for all)
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const pub = (file) => path.join(root, "public", file.replace(/^\//, ""));

function pngSize(file) {
  const buf = fs.readFileSync(file);
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

describe("app icons and share image", () => {
  const manifest = JSON.parse(fs.readFileSync(pub("manifest.webmanifest"), "utf8"));

  it("has a manifest with real icons, including a maskable one", () => {
    expect(manifest.display).toBe("standalone");
    for (const icon of manifest.icons) {
      const [w, h] = pngSize(pub(icon.src));
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("has a 180px apple-touch-icon and a 1200x630 share image", () => {
    expect(pngSize(pub("icons/apple-touch-icon.png"))).toEqual([180, 180]);
    expect(pngSize(pub("og-image.png"))).toEqual([1200, 630]);
  });

  it.each(["index.html", "link.html"])("%s points at them", (page) => {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<meta property="og:image" content="/og-image.png" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });
});
