import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { enableAutoUnmount, mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { reactive } from "vue";
import { useAppStore } from "@/stores/app";
import { useDialogStore } from "@/stores/dialog";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { linksApi } from "@/services/api/linksApi";
import { categoriesApi } from "@/services/api/categoriesApi";
import * as download from "@/lib/download";
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
vi.mock("@/services/api/categoriesApi", () => ({
  categoriesApi: { create: vi.fn(async ({ name }) => ({ id: name === "Recipes" ? 50 : 51, name })) },
}));
vi.mock("@/lib/download", () => ({ downloadText: vi.fn() }));
vi.mock("@/services/api/linksApi", () => ({
  linksApi: {
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
        "duplicates",
        "tidy",
        "stats",
        "add-many",
        "bookmarks",
        "share-list",
        "qr",
        "inspect",
      ]);
      expect(wrapper.text()).toContain("Look after your shelf");
      expect(wrapper.text()).toContain("Bring links in, send them out");
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
    });

    it("sends old tool addresses to the tool they were merged into", () => {
      mockRoute.query = { tool: "clean" };
      expect(mountTools().find('[data-testid="tool-inspect"]').exists()).toBe(true);
      mockRoute.query = { tool: "check" }; // removed tool
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

  describe("Shelf stats", () => {
    it("shows totals, sites and the links you never open", async () => {
      appStore.allLinks = [
        { id: 1, title: "Soup", url: "https://www.food.example/soup", created_at: "2020-01-01 00:00:00", open_count: 0, read_later: 1 },
        { id: 2, title: "Bread", url: "https://food.example/bread", created_at: "2020-01-02 00:00:00", open_count: 4 },
        { id: 3, title: "Theirs", url: "https://other.example", created_at: "2020-01-01 00:00:00", is_from_shared_category: 1 },
      ];
      appStore.linksLoaded = true;
      mockRoute.query = { tool: "stats" };
      const wrapper = mountTools();
      await flushPromises();
      const tool = wrapper.find('[data-testid="stats-tool"]');
      expect(tool.find('[data-testid="stat-Links"]').text()).toContain("2");
      expect(tool.find('[data-testid="stat-To read"]').attributes("href")).toBe("/view?toread=1");
      expect(tool.find('[data-testid="stats-sites"]').text()).toContain("food.example");
      expect(tool.find('[data-testid="stats-opened"]').text()).toContain("Opened 4 times");
      expect(tool.find('[data-testid="stats-unopened"]').text()).toContain("Soup");
      expect(tool.find('[data-testid="stats-unopened"]').text()).not.toContain("Bread");
      expect(tool.text()).not.toContain("Theirs");
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

  it("has no row of tool icons over an open tool, only the way back", () => {
    mockRoute.query = { tool: "qr" };
    const wrapper = mountTools();
    expect(wrapper.find('[data-testid^="tool-tab-"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tools-back"]').exists()).toBe(true);
  });

  it("gives the way back its own line, clear of the tool's card", () => {
    mockRoute.query = { tool: "qr" };
    const nav = mountTools().find('nav[aria-label="Tools"]');
    // The page's space-y gap sits under it; a negative margin pulled the
    // card up against the link
    expect(nav.classes().some((c) => c.startsWith("-m"))).toBe(false);
    expect(nav.find('[data-testid="tools-back"]').classes()).toContain("rounded-full");
  });

  describe("Browser bookmarks", () => {
    const FILE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://have.dk/">Have it</A>
    <DT><H3>Recipes</H3>
    <DL><p>
      <DT><A HREF="https://food.dk/soup" TAGS="dinner">Soup</A>
    </DL><p>
    <DT><H3>work</H3>
    <DL><p>
      <DT><A HREF="https://jira.dk/">Jira</A>
    </DL><p>
    <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
  </DL><p>
</DL><p>`;

    async function choose(wrapper, text) {
      const input = wrapper.find('[data-testid="bookmarks-file"]');
      Object.defineProperty(input.element, "files", { value: [{ name: "bookmarks.html", text: async () => text }], configurable: true });
      await input.trigger("change");
      await flushPromises();
    }

    it("imports new links, with folders as categories", async () => {
      appStore.allLinks = [link(1, "https://have.dk")];
      appStore.categories = [{ id: 7, name: "Work" }];
      appStore.loadCategories = vi.fn().mockResolvedValue();
      mockRoute.query = { tool: "bookmarks" };
      const wrapper = mountTools();
      await choose(wrapper, FILE);
      expect(wrapper.find('[data-testid="bookmarks-summary"]').text()).toMatch(/2 new\s*1 already/);
      expect(wrapper.find('[data-testid="bookmarks-folders"]').text()).toContain("Recipes");

      await wrapper.find('[data-testid="bookmarks-import-start"]').trigger("click");
      await flushPromises();
      // "work" goes into the existing "Work"; only Recipes is a new category
      expect(categoriesApi.create).toHaveBeenCalledTimes(1);
      expect(categoriesApi.create).toHaveBeenCalledWith({ name: "Recipes" });
      expect(linksApi.create).toHaveBeenCalledWith({ url: "https://food.dk/soup", title: "Soup", category_id: 50, tags: ["dinner"] });
      expect(linksApi.create).toHaveBeenCalledWith({ url: "https://jira.dk/", title: "Jira", category_id: 7, tags: [] });
      expect(linksApi.create).toHaveBeenCalledTimes(2);
    });

    it("explains a file without links", async () => {
      mockRoute.query = { tool: "bookmarks" };
      const wrapper = mountTools();
      await choose(wrapper, "<p>hello</p>");
      expect(wrapper.find('[data-testid="bookmarks-error"]').exists()).toBe(true);
    });

    it("saves your own links as a bookmarks file", async () => {
      appStore.allLinks = [link(1, "https://a.dk"), link(2, "https://b.dk", { is_from_shared_category: 1 })];
      mockRoute.query = { tool: "bookmarks" };
      const wrapper = mountTools();
      await wrapper.find('[data-testid="bookmarks-export-save"]').trigger("click");
      const [html, name] = download.downloadText.mock.calls[0];
      expect(name).toMatch(/^hidden-shelf-bookmarks-\d{4}-\d\d-\d\d\.html$/);
      expect(html).toContain('HREF="https://a.dk"');
      expect(html).not.toContain("b.dk");
    });
  });

  describe("Copy as a list", () => {
    it("lists a category in the chosen format and copies it", async () => {
      appStore.allLinks = [link(1, "https://a.dk", { title: "Alpha" }), link(2, "https://b.dk", { title: "Beta", category_id: 2 })];
      appStore.categories = [{ id: 1, name: "Work" }, { id: 2, name: "Home" }];
      const writeText = vi.fn().mockResolvedValue();
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      mockRoute.query = { tool: "share-list" };
      const wrapper = mountTools();
      await wrapper.find('[data-testid="share-list-source"]').setValue("cat:1");
      expect(wrapper.find('[data-testid="share-list-output"]').element.value).toBe("## Work\n\n- [Alpha](https://a.dk)");
      await wrapper.find('[data-testid="share-list-format-text"]').setValue();
      expect(wrapper.find('[data-testid="share-list-output"]').element.value).toBe("Work\n\n\nAlpha\nhttps://a.dk");
      await wrapper.find('[data-testid="share-list-copy"]').trigger("click");
      expect(writeText).toHaveBeenCalledWith("Work\n\n\nAlpha\nhttps://a.dk");
    });
  });

  it("makes a QR code that joins a Wi-Fi network", async () => {
    mockRoute.query = { tool: "qr" };
    const wrapper = mountTools();
    await wrapper.find('[data-testid="qr-mode-wifi"]').trigger("click");
    await wrapper.find('[data-testid="wifi-ssid"]').setValue("Home;Net");
    await wrapper.find('[data-testid="wifi-password"]').setValue("pa:ss");
    await flushPromises();
    const QRCode = (await import("qrcode")).default;
    expect(QRCode.toDataURL).toHaveBeenLastCalledWith(String.raw`WIFI:T:WPA;S:Home\;Net;P:pa\:ss;;`, expect.anything());
    // The alt text doesn't read the password out
    expect(wrapper.find('[data-testid="link-qr"] img').attributes("alt")).toBe("QR code to join the Wi-Fi network Home;Net");
  });

  it("has a hover title on every button, in every tool", async () => {
    appStore.allLinks = [
      link(1, "https://a.dk/?utm_source=x", { category_id: null, tags: [] }),
      link(2, "https://a.dk/"),
    ];
    appStore.tags = [{ id: 1, name: "t", usage_count: 2 }];
    for (const tool of ["", "duplicates", "tidy", "stats", "add-many", "bookmarks", "share-list", "qr", "inspect"]) {
      mockRoute.query = tool ? { tool } : {};
      const missing = mountTools()
        .findAll("button")
        .filter((b) => !b.attributes("title"))
        .map((b) => `${tool}: ${b.text()}`);
      expect(missing).toEqual([]);
    }
  });
});
