import { afterEach, describe, expect, it, vi } from "vitest";
import { dataUrlToBlob, saveImage } from "@/lib/saveImage";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function pointer(coarse) {
  window.matchMedia = vi.fn((query) => ({
    matches: query === "(pointer: coarse)" ? coarse : !coarse,
  }));
}

describe("saveImage", () => {
  afterEach(() => {
    delete navigator.canShare;
    delete navigator.share;
    vi.restoreAllMocks();
  });

  it("turns a data: URL into a blob of the right type", async () => {
    const blob = dataUrlToBlob(PNG);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(8);
  });

  it("uses the share sheet on phones, so Safari can Save Image", async () => {
    pointer(true);
    navigator.canShare = vi.fn(() => true);
    navigator.share = vi.fn().mockResolvedValue();
    expect(await saveImage(PNG, "qr.png")).toBe("shared");
    const [{ files }] = navigator.share.mock.calls[0];
    expect(files[0].name).toBe("qr.png");
    expect(files[0].type).toBe("image/png");
  });

  it("is quiet when the share sheet is closed", async () => {
    pointer(true);
    navigator.canShare = vi.fn(() => true);
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" }));
    expect(await saveImage(PNG, "qr.png")).toBe("cancelled");
  });

  it("downloads from a blob: URL with a mouse, not a data: link", async () => {
    pointer(false);
    navigator.share = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:qr");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      expect(this.href).toBe("blob:qr");
      expect(this.download).toBe("qr.png");
    });
    expect(await saveImage(PNG, "qr.png")).toBe("downloaded");
    expect(click).toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
  });
});
