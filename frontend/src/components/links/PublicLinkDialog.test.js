import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { usePublicShareStore } from "@/stores/publicShare";
import PublicLinkDialog from "@/components/links/PublicLinkDialog.vue";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,QR") },
}));

describe("PublicLinkDialog", () => {
  let pinia, wrapper, share;
  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    share = usePublicShareStore();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue() } });
    wrapper = mount(PublicLinkDialog, {
      global: { plugins: [pinia], stubs: { Teleport: true } },
    });
  });

  it("only opens for a public link", async () => {
    share.open({ id: 1, title: "Secret", is_public: 0, hash: "x" });
    await flushPromises();
    expect(wrapper.find('[data-testid="public-link-dialog"]').exists()).toBe(false);
  });

  it("shows the short link to copy and its QR code", async () => {
    share.open({ id: 1, title: "Grafana", is_public: 1, hash: "abc" });
    await flushPromises();
    const url = `${window.location.origin}/h/abc`;
    expect(wrapper.find('input[aria-label="Public link"]').element.value).toBe(url);
    expect(wrapper.find('[data-testid="link-qr"] img').attributes("src")).toBe(
      "data:image/png;base64,QR",
    );
    await wrapper.find('[data-testid="public-link-copy"]').trigger("click");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(url);
  });

  it("closes on Escape and on the close button", async () => {
    share.open({ id: 1, title: "Grafana", is_public: 1, hash: "abc" });
    await flushPromises();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(share.link).toBeNull();

    share.open({ id: 1, title: "Grafana", is_public: 1, hash: "abc" });
    await flushPromises();
    await wrapper.find('[aria-label="Close"]').trigger("click");
    expect(share.link).toBeNull();
    wrapper.unmount();
  });
});
