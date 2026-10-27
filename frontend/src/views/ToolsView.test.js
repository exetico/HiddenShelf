import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { reactive } from "vue";
import { useLinkEditorStore } from "@/stores/linkEditor";
import ToolsView from "@/views/ToolsView.vue";

const mockRoute = reactive({ name: "tools", query: {} });
const mockReplace = vi.fn((to) => {
  mockRoute.query = to.query;
});
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ replace: mockReplace }),
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AA") },
}));

describe("ToolsView", () => {
  let pinia;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    mockRoute.query = {};
    mockReplace.mockClear();
  });

  const mountTools = () => mount(ToolsView, { global: { plugins: [pinia] } });

  it("opens the QR tool first and switches tools through the address", async () => {
    const wrapper = mountTools();
    expect(wrapper.find('[data-testid="tool-qr"]').exists()).toBe(true);
    await wrapper.find('[data-testid="tool-tab-clean"]').trigger("click");
    expect(mockReplace).toHaveBeenCalledWith({ name: "tools", query: { tool: "clean" } });
    expect(wrapper.find('[data-testid="tool-clean"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tool-tab-clean"]').attributes("aria-selected")).toBe("true");
  });

  it("falls back to the QR tool for an unknown ?tool=", () => {
    mockRoute.query = { tool: "nope" };
    expect(mountTools().find('[data-testid="tool-qr"]').exists()).toBe(true);
  });

  it("makes a QR code, and offers to save long addresses for a shorter one", async () => {
    const wrapper = mountTools();
    await wrapper.find('[data-testid="qr-input"]').setValue("example.com");
    await flushPromises();
    expect(wrapper.find('[data-testid="link-qr"] img').attributes("alt")).toBe(
      "QR code for https://example.com/",
    );
    expect(wrapper.find('[data-testid="qr-long-hint"]').exists()).toBe(false);

    const long = `https://example.com/${"a".repeat(100)}`;
    await wrapper.find('[data-testid="qr-input"]').setValue(long);
    await wrapper.find('[data-testid="qr-save"]').trigger("click");
    expect(useLinkEditorStore().link).toMatchObject({ url: long });
  });

  it("encodes and decodes as you type", async () => {
    mockRoute.query = { tool: "encode" };
    const wrapper = mountTools();
    await wrapper.find('[data-testid="code-input"]').setValue("a b/c");
    expect(wrapper.find('[data-testid="code-encoded"]').text()).toBe("a%20b%2Fc");
    await wrapper.find('[data-testid="code-mode-url"]').setValue();
    expect(wrapper.find('[data-testid="code-encoded"]').text()).toBe("a%20b/c");
    await wrapper.find('[data-testid="code-input"]').setValue("50%");
    expect(wrapper.find('[data-testid="code-error"]').exists()).toBe(true);
  });

  it("cleans tracking off a link and can save the result", async () => {
    mockRoute.query = { tool: "clean" };
    const wrapper = mountTools();
    await wrapper.find('[data-testid="clean-input"]').setValue("https://x.dk/?a=1&utm_source=nl&gclid=9");
    expect(wrapper.find('[data-testid="clean-output"]').text()).toBe("https://x.dk/?a=1");
    expect(wrapper.find('[data-testid="clean-removed"]').text()).toBe("Removed utm_source, gclid.");
    await wrapper.find('[data-testid="clean-save"]').trigger("click");
    expect(useLinkEditorStore().link).toMatchObject({ url: "https://x.dk/?a=1" });
  });

  it("lists an address's parts and marks tracking parameters", async () => {
    mockRoute.query = { tool: "inspect" };
    const wrapper = mountTools();
    await wrapper.find('[data-testid="inspect-input"]').setValue("https://x.dk/p?q=1&fbclid=z");
    expect(wrapper.find('[data-testid="inspect-parts"]').text()).toContain("x.dk");
    const rows = wrapper.findAll('[data-testid="inspect-params"] tr').map((r) => r.text());
    expect(rows).toEqual(["q 1", "fbclid tracking z"].map((t) => expect.stringMatching(t.replace(/ /g, "\\s*"))));
  });

  it("has a hover title on every button", () => {
    const missing = mountTools().findAll("button").filter((b) => !b.attributes("title"));
    expect(missing).toEqual([]);
  });
});
