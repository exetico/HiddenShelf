import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { enableAutoUnmount, mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { reactive } from "vue";
import { useAppStore } from "@/stores/app";
import { useDialogStore } from "@/stores/dialog";
import { useLinkCheckStore } from "@/stores/linkCheck";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { linksApi } from "@/services/api/linksApi";
import ToolsView from "@/views/ToolsView.vue";

const mockRoute = reactive({ name: "tools", query: {} });
const mockPush = vi.fn((to) => {
  mockRoute.query = to.query;
});
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AA") },
}));
vi.mock("@/services/api/linksApi", () => ({
  linksApi: {
    check: vi.fn(),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({}),
    restore: vi.fn().mockResolvedValue({}),
    list: vi.fn(),
  },
}));

const link = (id, url, extra = {}) => ({
  id,
  url,
  title: `Link ${id}`,
  category_id: 1,
  tags: [{ id: 1, name: "t" }],
  created_at: `2026-01-0${id} 10:00:00`,
  ...extra,
});

describe("ToolsView", () => {
  // Mounted pages share the fake route, so unmount each before the next
  enableAutoUnmount(afterEach);
  let pinia, appStore;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    appStore = useAppStore();
    appStore.linksLoaded = true;
    appStore.categories = [{ id: 1, name: "Work" }];
    appStore.allLinks = [];
    appStore.refreshLinks = vi.fn().mockResolvedValue();
    appStore.loadTags = vi.fn().mockResolvedValue();
    mockRoute.query = {};
    mockPush.mockClear();
    vi.clearAllMocks();
  });

  const mountTools = () => mount(ToolsView, { global: { plugins: [pinia] } });

  describe("overview", () => {
    it("shows every tool as a card, grouped, and opens one through the address", async () => {
      const wrapper = mountTools();
      const cards = wrapper.findAll('[data-testid^="tool-card-"]');
      expect(cards.map((c) => c.attributes("data-testid").replace("tool-card-", ""))).toEqual([
        "check",
        "duplicates",
        "tidy",
        "add-many",
        "qr",
        "inspect",
      ]);
      expect(wrapper.text()).toContain("Look after your shelf");
      expect(wrapper.text()).toContain("Work with a link");
      await wrapper.find('[data-testid="tool-card-tidy"]').trigger("click");
      expect(mockPush).toHaveBeenCalledWith({ name: "tools", query: { tool: "tidy" } });
      expect(wrapper.find('[data-testid="tool-tidy"]').exists()).toBe(true);
    });

    it("says on each shelf card what it found", async () => {
      appStore.allLinks = [
        link(1, "https://a.dk/x"),
        link(2, "http://www.a.dk/x/"),
        link(3, "https://b.dk", { tags: [] }),
      ];
      const wrapper = mountTools();
      expect(wrapper.find('[data-testid="tool-insight-duplicates"]').text()).toBe("1 page saved twice or more");
      expect(wrapper.find('[data-testid="tool-insight-tidy"]').text()).toBe("1 link to look at");
      expect(wrapper.find('[data-testid="tool-insight-check"]').text()).toBe("3 links to check");

      const check = useLinkCheckStore();
      check.checkedAt = Date.now();
      check.results = { 1: { id: 1, status: "broken" } };
      await flushPromises();
      expect(wrapper.find('[data-testid="tool-insight-check"]').text()).toBe("1 broken");
    });

    it("sends old tool addresses to the tool they were merged into", () => {
      mockRoute.query = { tool: "clean" };
      expect(mountTools().find('[data-testid="tool-inspect"]').exists()).toBe(true);
      mockRoute.query = { tool: "nope" };
      expect(mountTools().find('[data-testid="tool-card-qr"]').exists()).toBe(true);
    });
  });

  it("explains the open tool, and goes back to all tools", async () => {
    mockRoute.query = { tool: "duplicates" };
    const wrapper = mountTools();
    expect(wrapper.find('[data-testid="tool-description"]').text()).toMatch(/same page/);
    await wrapper.find('[data-testid="tools-back"]').trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "tools", query: {} });
  });

  describe("Check links", () => {
    it("checks your own links in batches and lists broken and moved ones", async () => {
      appStore.allLinks = [
        ...Array.from({ length: 21 }, (_, i) => link(i + 1, `https://site${i + 1}.dk/`)),
        link(99, "https://shared.dk/", { is_from_shared_category: 1 }),
      ];
      linksApi.check.mockImplementation(async (ids) =>
        ids.map((id) => ({
          id,
          status: id === 1 ? "broken" : id === 2 ? "moved" : "ok",
          reason: id === 1 ? "The page is gone (404)" : "",
          final_url: id === 2 ? "https://new.dk/" : null,
        })),
      );
      mockRoute.query = { tool: "check" };
      const wrapper = mountTools();
      await wrapper.find('[data-testid="check-start"]').trigger("click");
      await flushPromises();

      expect(linksApi.check).toHaveBeenCalledTimes(2);
      expect(linksApi.check.mock.calls[0][0]).toHaveLength(20);
      expect(linksApi.check.mock.calls.flat(2)).not.toContain(99);
      expect(wrapper.find('[data-testid="check-broken"]').text()).toContain("The page is gone (404)");
      expect(wrapper.find('[data-testid="check-moved"]').text()).toContain("Now at https://new.dk/");

      appStore.updateLink = vi.fn().mockResolvedValue();
      await wrapper.find('[data-testid="check-use-new"]').trigger("click");
      await flushPromises();
      expect(appStore.updateLink).toHaveBeenCalledWith(2, { url: "https://new.dk/" });
      expect(wrapper.find('[data-testid="check-moved"]').exists()).toBe(false);
    });

    it("shows the server's message when checking stops", async () => {
      appStore.allLinks = [link(1, "https://a.dk")];
      linksApi.check.mockRejectedValue(new Error("Try again in 5 minutes."));
      mockRoute.query = { tool: "check" };
      const wrapper = mountTools();
      await wrapper.find('[data-testid="check-start"]').trigger("click");
      await flushPromises();
      expect(wrapper.find('[data-testid="check-error"]').text()).toBe("Try again in 5 minutes.");
    });
  });

  describe("Duplicates", () => {
    it("keeps the one you pick and trashes the rest", async () => {
      appStore.allLinks = [
        link(1, "https://a.dk/x"),
        link(2, "https://a.dk/x?utm_source=mail"),
        link(3, "https://b.dk"),
      ];
      vi.spyOn(useDialogStore(), "confirm").mockResolvedValue(true);
      mockRoute.query = { tool: "duplicates" };
      const wrapper = mountTools();
      const groups = wrapper.findAll('[data-testid="duplicate-group"]');
      expect(groups).toHaveLength(1);
      await groups[0].findAll('[data-testid="duplicate-keep"]')[1].trigger("click");
      await flushPromises();
      expect(linksApi.remove).toHaveBeenCalledWith(1);
      expect(linksApi.remove).not.toHaveBeenCalledWith(2);
      expect(appStore.refreshLinks).toHaveBeenCalled();
    });

    it("says so when there are none", () => {
      appStore.allLinks = [link(1, "https://a.dk"), link(2, "https://b.dk")];
      mockRoute.query = { tool: "duplicates" };
      expect(mountTools().find('[data-testid="duplicates-none"]').exists()).toBe(true);
    });
  });

  describe("Tidy up", () => {
    it("counts each check and cleans tracking off every link at once", async () => {
      appStore.allLinks = [
        link(1, "https://a.dk/?utm_source=x", { category_id: null }),
        link(2, "https://b.dk/?fbclid=1&q=2"),
        link(3, "https://c.dk", { tags: [] }),
      ];
      mockRoute.query = { tool: "tidy" };
      const wrapper = mountTools();
      expect(wrapper.find('[data-testid="tidy-tab-uncategorized"]').text()).toContain("1");
      expect(wrapper.find('[data-testid="tidy-tab-untagged"]').text()).toContain("1");
      expect(wrapper.find('[data-testid="tidy-tab-tracking"]').text()).toContain("2");

      await wrapper.find('[data-testid="tidy-tab-tracking"]').trigger("click");
      await wrapper.find('[data-testid="tidy-clean-all"]').trigger("click");
      await flushPromises();
      expect(linksApi.update).toHaveBeenCalledWith(1, { url: "https://a.dk/" });
      expect(linksApi.update).toHaveBeenCalledWith(2, { url: "https://b.dk/?q=2" });
    });

    it("opens the editor to pick a category", async () => {
      appStore.allLinks = [link(1, "https://a.dk", { category_id: null })];
      mockRoute.query = { tool: "tidy" };
      const wrapper = mountTools();
      await wrapper.find('[data-testid="tidy-uncategorized"] button').trigger("click");
      expect(useLinkEditorStore().link).toMatchObject({ id: 1 });
    });
  });

  describe("Add many links", () => {
    it("picks addresses out of pasted text and adds only the new ones", async () => {
      appStore.allLinks = [link(1, "https://have.dk/page")];
      mockRoute.query = { tool: "add-many" };
      const wrapper = mountTools();
      await wrapper
        .find('[data-testid="add-many-input"]')
        .setValue("Read https://new.dk/my-post?utm_source=nl, and www.have.dk/page/ e.g. today");
      expect(wrapper.findAll('[data-testid="add-many-item"]')).toHaveLength(2);
      expect(wrapper.find('[data-testid="add-many-summary"]').text()).toMatch(/1 new\s*1 already/);

      await wrapper.find('[data-testid="add-many-category"]').setValue(1);
      await wrapper.find('[data-testid="add-many-tags"]').setValue("read later, , blog");
      await wrapper.find('[data-testid="add-many-submit"]').trigger("click");
      await flushPromises();
      expect(linksApi.create).toHaveBeenCalledTimes(1);
      expect(linksApi.create).toHaveBeenCalledWith({
        url: "https://new.dk/my-post",
        title: "My post · new.dk",
        category_id: 1,
        tags: ["read later", "blog"],
      });
      expect(appStore.refreshLinks).toHaveBeenCalled();
    });

    it("says when the text has no addresses", async () => {
      mockRoute.query = { tool: "add-many" };
      const wrapper = mountTools();
      await wrapper.find('[data-testid="add-many-input"]').setValue("just some words");
      expect(wrapper.find('[data-testid="add-many-nothing"]').exists()).toBe(true);
    });
  });

  it("makes a QR code, and offers to save long addresses for a shorter one", async () => {
    mockRoute.query = { tool: "qr" };
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

  it("uses a public link's short address for its QR code", async () => {
    appStore.allLinks = [link(1, "https://example.com/very/long", { is_public: 1, hash: "abc123" })];
    mockRoute.query = { tool: "qr" };
    const wrapper = mountTools();
    await wrapper.find('[data-testid="qr-input"]').setValue("https://example.com/very/long");
    await flushPromises();
    expect(wrapper.find('[data-testid="link-qr"] img').attributes("alt")).toMatch(/\/h\/abc123$/);
  });

  describe("Inspect a link", () => {
    it("lists an address's parts, marks tracking and offers a clean copy", async () => {
      mockRoute.query = { tool: "inspect" };
      const wrapper = mountTools();
      await wrapper.find('[data-testid="inspect-input"]').setValue("https://x.dk/p?q=1&fbclid=z");
      expect(wrapper.find('[data-testid="inspect-parts"]').text()).toContain("x.dk");
      const rows = wrapper.findAll('[data-testid="inspect-params"] tr').map((r) => r.text());
      expect(rows).toEqual(["q 1", "fbclid tracking z"].map((t) => expect.stringMatching(t.replace(/ /g, "\\s*"))));
      expect(wrapper.find('[data-testid="clean-output"]').text()).toBe("https://x.dk/p?q=1");
      expect(wrapper.find('[data-testid="clean-removed"]').text()).toMatch(/fbclid/);
      await wrapper.find('[data-testid="clean-save"]').trigger("click");
      expect(useLinkEditorStore().link).toMatchObject({ url: "https://x.dk/p?q=1" });
    });

    it("encodes and decodes as you type", async () => {
      mockRoute.query = { tool: "inspect" };
      const wrapper = mountTools();
      await wrapper.find('[data-testid="code-input"]').setValue("a b/c");
      expect(wrapper.find('[data-testid="code-encoded"]').text()).toBe("a%20b%2Fc");
      await wrapper.find('[data-testid="code-mode-url"]').setValue();
      expect(wrapper.find('[data-testid="code-encoded"]').text()).toBe("a%20b/c");
      await wrapper.find('[data-testid="code-input"]').setValue("50%");
      expect(wrapper.find('[data-testid="code-error"]').exists()).toBe(true);
    });
  });

  it("has a hover title on every button, in every tool", async () => {
    appStore.allLinks = [
      link(1, "https://a.dk/?utm_source=x", { category_id: null, tags: [] }),
      link(2, "https://a.dk/"),
    ];
    for (const tool of ["", "check", "duplicates", "tidy", "add-many", "qr", "inspect"]) {
      mockRoute.query = tool ? { tool } : {};
      const missing = mountTools()
        .findAll("button")
        .filter((b) => !b.attributes("title"))
        .map((b) => `${tool}: ${b.text()}`);
      expect(missing).toEqual([]);
    }
  });
});
