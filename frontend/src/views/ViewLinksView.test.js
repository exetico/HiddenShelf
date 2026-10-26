import { describe, expect, it, vi, beforeEach } from "vitest";
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
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("ViewLinksView", () => {
  let pinia;

  beforeEach(() => {
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
      const chips = wrapper.findAll("button.rounded-full");
      expect(chips.map((c) => c.text())).toEqual(["Work"]);

      await chips[0].trigger("click");
      expect(appStore.filterCategory).toBe("1");
      await chips[0].trigger("click");
      expect(appStore.filterCategory).toBe("");
    });

    it("has no favorite chip row without favorites", () => {
      const wrapper = mountView();
      expect(wrapper.findAll("button.rounded-full")).toHaveLength(0);
    });
  });

  describe("wide screens", () => {
    it("uses two columns when there is more than one category", () => {
      const groups = mountView().find('[data-testid="link-groups"]');
      expect(groups.classes()).toEqual(expect.arrayContaining(["xl:columns-2"]));
    });

    it("stays one column for a single category", () => {
      useAppStore().filterCategory = "1";
      const groups = mountView().find('[data-testid="link-groups"]');
      expect(groups.classes()).not.toContain("xl:columns-2");
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
