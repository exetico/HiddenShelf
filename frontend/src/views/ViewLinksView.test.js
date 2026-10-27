import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import ViewLinksView from "@/views/ViewLinksView.vue";
import { useLinkDetailsStore } from "@/stores/linkDetails";

// Mock child components
vi.mock("@/components/links/LinkCardView.vue", () => ({
  default: {
    name: "LinkCardView",
    template:
      '<div class="link-card" @click="$emit(\'details\', link)">{{ link.title }}</div>',
    props: ["link", "groupKey", "reorderable"],
    emits: ["details", "reorder", "copyPublic", "contextAction"],
  },
}));
vi.mock("@/components/categories/CategoryFilterBar.vue", () => ({
  default: { template: "<div>FilterBar</div>" },
}));
vi.mock("@/services/api/linksApi", () => ({
  linksApi: {
    list: vi.fn().mockResolvedValue({
      links: [],
      pagination: { page: 1, pages: 1, limit: 20, total: 0 },
    }),
  },
}));
const mockRoute = { query: {} };
const mockReplace = vi.fn((to) => { mockRoute.query = to.query; });
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
}));

describe("ViewLinksView", () => {
  let pinia;

  beforeEach(() => {
    mockRoute.query = {};
    pinia = createPinia();
    setActivePinia(pinia);

    const appStore = useAppStore();
    appStore.links = [
      { id: 1, title: "Link A", category_id: 1, url: "https://a.com" },
      { id: 2, title: "Link B", category_id: 1, url: "https://b.com" },
      { id: 3, title: "Link C", category_id: null, url: "https://c.com" },
    ];
    appStore.categories = [
      { id: 1, name: "Work", icon: "mdi-briefcase", color: "#ff0000" },
    ];
    appStore.sharedCategories = [];
    appStore.total = 3;
    appStore.search = "";
    appStore.filterCategory = "";

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue() },
    });
  });

  function mountView() {
    return mount(ViewLinksView, {
      global: { plugins: [pinia] },
    });
  }

  it("displays 'Showing X of Y links' counter", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("Showing 3 of 3 links");
  });

  it("renders category group headers", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("Work");
    expect(wrapper.text()).toContain("Uncategorized");
  });

  it("shows collapse chevron icons on category headers", () => {
    const wrapper = mountView();
    const chevrons = wrapper.findAll(".mdi-chevron-down");
    expect(chevrons.length).toBeGreaterThan(0);
  });

  it("toggles category collapse on header click", async () => {
    const wrapper = mountView();

    // Find a category header button
    const headers = wrapper.findAll("button.group");
    expect(headers.length).toBeGreaterThan(0);

    await headers[0].trigger("click");

    // After click, should show chevron-right (collapsed)
    const collapsed = wrapper.findAll(".mdi-chevron-right");
    expect(collapsed.length).toBeGreaterThan(0);
  });

  it("shows link count per category group", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("(2)"); // Work has 2 links
    expect(wrapper.text()).toContain("(1)"); // Uncategorized has 1 link
  });

  it("shows empty state with icon when no links", () => {
    const appStore = useAppStore();
    appStore.links = [];
    appStore.total = 0;

    const wrapper = mountView();
    expect(wrapper.text()).toContain("No links found");
    expect(wrapper.find(".mdi-link-off").exists()).toBe(true);
  });

  it("shows Load More button when hasMore is true", () => {
    const appStore = useAppStore();
    appStore.total = 100; // More than loaded

    const wrapper = mountView();
    expect(wrapper.text()).toContain("Load more");
  });

  it("hides Load More button when all links loaded", () => {
    const appStore = useAppStore();
    appStore.total = 3; // Same as loaded

    const wrapper = mountView();
    expect(wrapper.text()).not.toContain("Load more");
  });

  it("shows shared category owner badge", () => {
    const appStore = useAppStore();
    appStore.links = [
      {
        id: 10,
        title: "Shared Link",
        category_id: 99,
        url: "https://shared.com",
      },
    ];
    appStore.sharedCategories = [
      {
        id: 99,
        name: "Friend Links",
        icon: "mdi-folder",
        color: "#333",
        owner_email: "friend@test.com",
      },
    ];

    const wrapper = mountView();
    expect(wrapper.text()).toContain("shared by friend@test.com");
  });

  describe("mobile layout", () => {
    it("puts the category picker in the search row and hides the bar on phones", () => {
      const wrapper = mountView();
      const searchRow = wrapper
        .find('input[type="search"]')
        .element.closest('[data-testid="page-search"]');
      expect(searchRow.querySelector('[aria-haspopup="dialog"]')).not.toBeNull();
      expect(wrapper.html()).toContain("hidden sm:block");
    });

    it("shows favorite categories as chips that toggle the filter", async () => {
      const appStore = useAppStore();
      appStore.categories = [
        { id: 1, name: "Work", is_favorite: 1 },
        { id: 2, name: "Home", is_favorite: 0 },
      ];
      const wrapper = mountView();
      const strip = wrapper.find('[data-testid="favorite-categories"]');
      const chips = strip.findAll("button");
      expect(chips.map((c) => c.text())).toEqual(["Work"]);
      expect(chips[0].attributes("data-testid")).toBe("favorite-category-1");

      await chips[0].trigger("click");
      expect(appStore.filterCategory).toBe("1");
      await chips[0].trigger("click");
      expect(appStore.filterCategory).toBe("");
    });

    it("has no favorite chip row without favorites", () => {
      const wrapper = mountView();
      expect(wrapper.find('[data-testid="favorite-categories"]').exists()).toBe(false);
    });

    it("names its main parts, so they can be referred to", () => {
      const appStore = useAppStore();
      appStore.total = 40;
      const wrapper = mountView();
      for (const id of ["view-page", "page-search", "link-count", "link-groups", "scroll-sentinel", "load-more"]) {
        expect(wrapper.find(`[data-testid="${id}"]`).exists(), id).toBe(true);
      }
      expect(wrapper.find('[data-testid="link-group-1"]').exists()).toBe(true);
    });
  });

  describe("wide screens", () => {
    let wide;
    beforeEach(() => {
      wide = true;
      window.matchMedia = (query) => ({
        matches: query.includes("1280") ? wide : false,
        addEventListener() {},
        removeEventListener() {},
      });
    });
    afterEach(() => {
      delete window.matchMedia;
    });

    const columnTitles = (wrapper) =>
      wrapper
        .findAll('[data-testid="link-column"]')
        .map((col) => col.findAll("h2").map((h) => h.text()));

    it("splits categories over two columns, each to the shorter one", () => {
      const appStore = useAppStore();
      appStore.categories = [
        { id: 1, name: "Big" },
        { id: 2, name: "Small" },
        { id: 3, name: "Third" },
      ];
      appStore.links = [
        ...Array.from({ length: 10 }, (_, i) => ({ id: i + 1, title: `B${i}`, category_id: 1, url: "https://b.com" })),
        { id: 20, title: "S", category_id: 2, url: "https://s.com" },
        { id: 21, title: "T", category_id: 3, url: "https://t.com" },
      ];
      const wrapper = mountView();
      expect(wrapper.find('[data-testid="link-groups"]').classes()).toContain("grid-cols-2");
      expect(columnTitles(wrapper)).toEqual([["Big"], ["Small", "Third"]]);
    });

    it("adds later categories at the bottom without moving earlier ones", async () => {
      const appStore = useAppStore();
      appStore.categories = [
        { id: 1, name: "One" },
        { id: 2, name: "Two" },
        { id: 3, name: "Three" },
      ];
      appStore.links = [
        { id: 1, title: "a", category_id: 1, url: "https://a.com" },
        { id: 2, title: "b", category_id: 2, url: "https://b.com" },
      ];
      const wrapper = mountView();
      const before = columnTitles(wrapper);
      appStore.links = [...appStore.links, { id: 3, title: "c", category_id: 3, url: "https://c.com" }];
      await wrapper.vm.$nextTick();
      const after = columnTitles(wrapper);
      expect(after[0].slice(0, before[0].length)).toEqual(before[0]);
      expect(after[1].slice(0, before[1].length)).toEqual(before[1]);
    });

    it("stays one column for a single category, and on narrower screens", () => {
      useAppStore().filterCategory = "1";
      expect(mountView().findAll('[data-testid="link-column"]')).toHaveLength(1);
      useAppStore().filterCategory = "";
      wide = false;
      expect(mountView().findAll('[data-testid="link-column"]')).toHaveLength(1);
    });
  });

  it("opens details with previous/next across the visible links", async () => {
    const wrapper = mountView();
    await wrapper.findAll(".link-card").find((c) => c.text() === "Link B").trigger("click");
    const details = useLinkDetailsStore();
    expect(details.current.title).toBe("Link B");
    expect(details.links.map((l) => l.title)).toEqual(["Link C", "Link A", "Link B"]);
  });

  it("saves a drag-and-drop move within a category", async () => {
    const appStore = useAppStore();
    appStore.reorderLinks = vi.fn();
    const wrapper = mountView();
    const cards = wrapper.findAllComponents({ name: "LinkCardView" });
    const cardA = cards.find((c) => c.props("link").title === "Link A");
    expect(cardA.props("reorderable")).toBe(true);
    cardA.vm.$emit("reorder", { groupKey: 1, draggedId: 2, targetId: 1, position: "before" });
    await wrapper.vm.$nextTick();
    expect(appStore.reorderLinks).toHaveBeenCalledWith([2, 1]);
  });

  it("doesn't offer dragging in a category shared with you", () => {
    const appStore = useAppStore();
    appStore.links = [
      { id: 8, title: "S1", category_id: 50, url: "https://s.com" },
      { id: 9, title: "S2", category_id: 50, url: "https://t.com" },
    ];
    appStore.sharedCategories = [{ id: 50, name: "Team", owner_email: "x@y.z" }];
    const cards = mountView().findAllComponents({ name: "LinkCardView" });
    expect(cards.every((c) => c.props("reorderable") === false)).toBe(true);
  });

  it("turns dragging off while the list is sorted, and back on for your own order", async () => {
    const appStore = useAppStore();
    appStore.links = [
      { id: 8, title: "S1", category_id: 1, url: "https://s.com" },
      { id: 9, title: "S2", category_id: 1, url: "https://t.com" },
    ];
    appStore.categories = [{ id: 1, name: "Work" }];
    appStore.sort = "title";
    const wrapper = mountView();
    const draggable = () =>
      wrapper.findAllComponents({ name: "LinkCardView" }).map((c) => c.props("reorderable"));
    expect(draggable()).toEqual([false, false]);
    appStore.sort = "";
    await nextTick();
    expect(draggable()).toEqual([true, true]);
  });

  describe("favorites", () => {
    const favs = () => [
      { id: 2, title: "Link B", category_id: 1, url: "https://b.com", is_favorite: 1 },
      { id: 3, title: "Link C", category_id: null, url: "https://c.com", is_favorite: 1 },
    ];

    it("lists favorites first, in a group you can't drag in", () => {
      const appStore = useAppStore();
      appStore.favoriteLinks = favs();
      const wrapper = mountView();
      expect(wrapper.findAll("h2").map((h) => h.text())[0]).toBe("Favorites");
      const cards = wrapper.findAllComponents({ name: "LinkCardView" });
      const favCards = cards.filter((c) => c.props("groupKey") === "favorites");
      expect(favCards.map((c) => c.props("link").title)).toEqual(["Link B", "Link C"]);
      expect(favCards.every((c) => c.props("reorderable") === false)).toBe(true);
    });

    it("hides the favorites group while searching or filtering", () => {
      const appStore = useAppStore();
      appStore.favoriteLinks = favs();
      appStore.search = "link";
      expect(mountView().findAll("h2").map((h) => h.text())).not.toContain("Favorites");
    });

    it("doesn't count a favorite twice in previous/next", async () => {
      const appStore = useAppStore();
      appStore.favoriteLinks = favs();
      const wrapper = mountView();
      await wrapper.findAll(".link-card")[0].trigger("click");
      const details = useLinkDetailsStore();
      expect(details.links.map((l) => l.id)).toEqual([2, 3, 1]);
    });
  });
});
