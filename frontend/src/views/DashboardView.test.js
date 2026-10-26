import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { useAppStore } from "@/stores/app";
import DashboardView from "@/views/DashboardView.vue";
import { useContextMenuStore } from "@/stores/contextMenu";

// Mock useTheme composable — isDark must be a real ref for template reactivity
const mockIsDark = ref(false);
const mockToggleTheme = vi.fn();
vi.mock("@/composables/useTheme", () => ({
  useTheme: () => ({
    isDark: mockIsDark,
    toggleTheme: mockToggleTheme,
  }),
}));

// Mock vue-router
const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock linkVisitsApi (used inside the store action on mount)
vi.mock("@/services/api/linkVisitsApi", () => ({
  linkVisitsApi: {
    getSummary: vi.fn().mockResolvedValue({
      total_visits: 0,
      days: 30,
      summary: [],
    }),
  },
}));

vi.mock("@/services/api/linksApi", () => ({
  linksApi: {
    list: vi.fn().mockResolvedValue({
      links: [],
      pagination: { page: 1, pages: 1, limit: 20, total: 0 },
    }),
    random: vi.fn(),
  },
}));

import { linksApi } from "@/services/api/linksApi";

describe("DashboardView", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    const appStore = useAppStore();
    appStore.total = 42;
    appStore.categories = [{ id: 1 }, { id: 2 }];
    appStore.sharedCategories = [];
    appStore.tags = [{ id: 1 }, { id: 2 }, { id: 3 }];
    appStore.links = [];
    appStore.visitStats = { total_visits: 0, days: 30, summary: [] };
    mockPush.mockClear();
    mockIsDark.value = false;
    mockToggleTheme.mockClear();
  });

  function mountDashboard() {
    return mount(DashboardView, {
      global: { plugins: [pinia] },
    });
  }

  it("shows welcome message", () => {
    const wrapper = mountDashboard();
    expect(wrapper.text()).toContain("Welcome back");
  });

  it("displays stats for links, categories, and tags", () => {
    const wrapper = mountDashboard();
    expect(wrapper.text()).toContain("42"); // links
    expect(wrapper.text()).toContain("2"); // categories
    expect(wrapper.text()).toContain("3"); // tags
  });

  it("stat cards are clickable buttons that navigate to edit", async () => {
    const wrapper = mountDashboard();
    const linksCard = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Links"));
    expect(linksCard).toBeDefined();
    await linksCard.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "edit" });
  });

  it("totalCategories includes shared categories", () => {
    const appStore = useAppStore();
    appStore.sharedCategories = [{ id: 99 }];
    const wrapper = mountDashboard();
    // 2 own + 1 shared = 3
    expect(wrapper.text()).toContain("3"); // totalCategories = 3
  });

  it("renders the quick action buttons", () => {
    const wrapper = mountDashboard();
    expect(wrapper.text()).toContain("View links");
    expect(wrapper.text()).toContain("Edit links");
    expect(wrapper.text()).toContain("Sharing");
  });

  it("keeps the welcome to one short line", () => {
    const header = mountDashboard().find('[data-testid="welcome"]');
    expect(header.find("h1").classes()).toContain("text-xl");
    expect(header.classes()).toContain("flex");
  });

  it("navigates to view links on click", async () => {
    const wrapper = mountDashboard();
    const viewBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("View links"));
    await viewBtn.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "view" });
  });

  it("navigates to edit links on click", async () => {
    const wrapper = mountDashboard();
    const editBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Edit links"));
    await editBtn.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "edit" });
  });

  it("has theme, profile and import/export in one row at the bottom", async () => {
    const wrapper = mountDashboard();
    const row = wrapper.find('[data-testid="settings-row"]');
    expect(row.findAll("button").map((b) => b.text())).toEqual([
      "Dark mode",
      "Profile",
      "Import / export",
    ]);
    await wrapper.find('[data-testid="settings-profile"]').trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "profile" });
    await wrapper.find('[data-testid="settings-data"]').trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "profile", query: { section: "data" } });
  });

  it("shows visit stats section when total_visits > 0", async () => {
    const appStore = useAppStore();
    appStore.visitStats = {
      total_visits: 15,
      days: 30,
      summary: [{ id: 1, title: "Popular Link", visit_count: 15 }],
    };
    const wrapper = mountDashboard();
    expect(wrapper.text()).toContain("15");
    expect(wrapper.text()).toContain("Popular Link");
  });

  it("hides visit stats section when no visits", () => {
    const wrapper = mountDashboard();
    expect(wrapper.text()).not.toContain("total visits");
  });

  it("toggles the theme from anywhere on its button", async () => {
    const wrapper = mountDashboard();
    const themeBtn = wrapper.find('[data-testid="settings-theme"]');
    expect(themeBtn.attributes("title")).toBe("Switch to dark mode");
    await themeBtn.find("span").trigger("click");
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    mockIsDark.value = true;
    await wrapper.vm.$nextTick();
    expect(themeBtn.text()).toBe("Light mode");
    expect(themeBtn.attributes("title")).toBe("Switch to light mode");
  });

  describe("Tags", () => {
    it("explains tags when there are none", () => {
      useAppStore().tags = [];
      expect(mountDashboard().text()).toContain("Tags group links across categories");
    });

    it("opens View filtered by the tapped tag", async () => {
      const appStore = useAppStore();
      appStore.tags = [{ id: 7, name: "recipes", usage_count: 3 }];
      appStore.search = "old";
      const wrapper = mountDashboard();
      const tag = wrapper.findAll("button").find((b) => b.text().includes("#recipes"));
      await tag.trigger("click");
      await flushPromises();
      expect(appStore.filterTag).toBe("7");
      expect(appStore.search).toBe("");
      expect(linksApi.list).toHaveBeenCalledWith(expect.objectContaining({ tagId: "7" }));
      expect(mockPush).toHaveBeenCalledWith({ name: "view" });
    });
  });

  describe("layout", () => {
    it("puts quick links before tags and tags before visits", () => {
      const appStore = useAppStore();
      appStore.tags = [{ id: 1, name: "a", usage_count: 2 }];
      appStore.visitStats = { total_visits: 5, days: 30, summary: [] };
      const text = mountDashboard().text();
      expect(text.indexOf("View links")).toBeLessThan(text.indexOf("Tap a tag"));
      expect(text.indexOf("Tap a tag")).toBeLessThan(text.indexOf("Link visits"));
    });

    it("shows visits as a compact header with the total and a short list", () => {
      const appStore = useAppStore();
      appStore.visitStats = {
        total_visits: 12,
        days: 30,
        summary: [{ id: 1, title: "Grafana", visit_count: 7 }],
      };
      const text = mountDashboard().text();
      expect(text).toContain("12 total");
      expect(text).toContain("Grafana");
      expect(text).not.toContain("7 visits");
    });
  });

  describe("Sharing card", () => {
    it("counts categories shared by and with me and opens the sharing section", async () => {
      const appStore = useAppStore();
      appStore.categories = [{ id: 1, is_shared: 1 }, { id: 2, is_shared: 0 }];
      appStore.sharedCategories = [{ id: 9 }, { id: 10 }];
      const wrapper = mountDashboard();
      const card = wrapper.findAll("button").find((b) => b.text().includes("Sharing"));
      expect(card.text()).toContain("1 shared by you");
      expect(card.text()).toContain("2 shared with you");
      await card.trigger("click");
      expect(mockPush).toHaveBeenCalledWith({
        name: "profile",
        query: { section: "sharing" },
      });
    });
  });

  describe("single-use tags", () => {
    const tagButtons = (wrapper) =>
      wrapper.findAll("button").filter((b) => b.text().startsWith("#"));

    it("hides tags used once behind a toggle", async () => {
      const appStore = useAppStore();
      appStore.tags = [
        { id: 1, name: "work", usage_count: 5 },
        { id: 2, name: "once", usage_count: 1 },
        { id: 3, name: "also-once", usage_count: 1 },
      ];
      const wrapper = mountDashboard();
      expect(tagButtons(wrapper).map((b) => b.text())).toEqual(["#work 5"]);

      const toggle = wrapper.findAll("button").find((b) => b.text().includes("Show 2 more"));
      await toggle.trigger("click");
      expect(tagButtons(wrapper)).toHaveLength(3);
      expect(wrapper.text()).toContain("Show fewer");
    });

    it("shows every tag when all of them are used once", () => {
      const appStore = useAppStore();
      appStore.tags = [
        { id: 1, name: "a", usage_count: 1 },
        { id: 2, name: "b", usage_count: 1 },
      ];
      const wrapper = mountDashboard();
      expect(tagButtons(wrapper)).toHaveLength(2);
      expect(wrapper.text()).not.toContain("Show");
    });
  });

  it("shows quick links two per row on phones with descriptions from sm up", () => {
    const wrapper = mountDashboard();
    const grid = wrapper.findAll("div.grid").find((g) => g.text().includes("View links"));
    expect(grid.classes()).toContain("grid-cols-2");
    const desc = grid.findAll("p").find((p) => p.text().includes("Browse categories"));
    expect(desc.classes()).toEqual(expect.arrayContaining(["hidden", "sm:block"]));
  });

  it("gives each stat tile a decorative icon on the right", () => {
    const wrapper = mountDashboard();
    for (const [key, icon] of [
      ["links", "mdi-link-variant"],
      ["categories", "mdi-folder-multiple-outline"],
      ["tags", "mdi-tag-multiple-outline"],
    ]) {
      const tile = wrapper.find(`[data-testid="stat-${key}"]`);
      const art = tile.find(".stat-art");
      expect(art.classes()).toEqual(
        expect.arrayContaining([icon, "absolute", "pointer-events-none"]),
      );
      expect(art.attributes("aria-hidden")).toBe("true");
      expect(tile.attributes("title")).toBeTruthy();
    }
  });

  it("has a hover title on every button", () => {
    const wrapper = mountDashboard();
    const missing = wrapper
      .findAll("button")
      .filter((b) => !b.attributes("title"))
      .map((b) => b.text());
    expect(missing).toEqual([]);
  });

  it("draws tile art without blurred blobs", () => {
    const tile = mountDashboard().find('[data-testid="stat-links"]');
    expect(tile.find(".blur-md").exists()).toBe(false);
    expect(tile.classes()).toEqual(
      expect.arrayContaining(["bg-linear-to-br", "to-sky-500/15"]),
    );
  });

  it("opens a menu when you right-click a tag", async () => {
    const appStore = useAppStore();
    appStore.tags = [{ id: 4, name: "infra", usage_count: 3 }];
    const wrapper = mountDashboard();
    const tag = wrapper.findAll("button").find((b) => b.text().includes("#infra"));
    await tag.trigger("contextmenu", { clientX: 10, clientY: 20 });
    const menu = useContextMenuStore();
    expect(menu.open).toBe(true);
    expect(menu.title).toBe("#infra");
    expect(menu.items.map((i) => i.label).filter(Boolean)).toEqual([
      "Show its links",
      "Delete tag",
    ]);
  });

  describe("I'm feeling lucky", () => {
    it("opens a random link in a tab it opened right away", async () => {
      const tab = { location: { href: "" }, close: vi.fn() };
      window.open = vi.fn(() => tab);
      linksApi.random.mockResolvedValue({ id: 1, url: "https://lucky.example.com" });
      const wrapper = mountDashboard();
      await wrapper.find('[data-testid="feeling-lucky"]').trigger("click");
      expect(window.open).toHaveBeenCalledWith("", "_blank");
      await flushPromises();
      expect(tab.location.href).toBe("https://lucky.example.com");
      expect(tab.opener).toBeNull();
    });

    it("closes the tab and explains when the shelf is empty", async () => {
      const tab = { location: { href: "" }, close: vi.fn() };
      window.open = vi.fn(() => tab);
      linksApi.random.mockRejectedValue(new Error("Your shelf is empty"));
      const wrapper = mountDashboard();
      await wrapper.find('[data-testid="feeling-lucky"]').trigger("click");
      await flushPromises();
      expect(tab.close).toHaveBeenCalled();
      const { useToastStore } = await import("@/stores/toast");
      expect(useToastStore().items[0].message).toBe("Add a link first, then try your luck");
    });
  });
});
