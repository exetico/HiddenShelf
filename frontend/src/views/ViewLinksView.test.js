import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import ViewLinksView from "@/views/ViewLinksView.vue";

// Mock child components
vi.mock("@/components/links/LinkCardView.vue", () => ({
  default: {
    template: '<div class="link-card">{{ link.title }}</div>',
    props: ["link"],
  },
}));
vi.mock("@/components/categories/CategoryFilterBar.vue", () => ({
  default: { template: "<div>FilterBar</div>" },
}));
vi.mock("@/components/common/ContextMenu.vue", () => ({
  default: { template: "<div></div>", props: ["open", "link"] },
}));

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
});
