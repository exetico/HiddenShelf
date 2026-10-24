import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import EditLinksView from "@/views/EditLinksView.vue";

// Mock child components
vi.mock("@/components/links/LinkCardEdit.vue", () => ({
  default: {
    template: '<div class="link-card">{{ link.title }}</div>',
    props: ["link"],
  },
}));
vi.mock("@/components/links/LinkFormModal.vue", () => ({
  default: { template: "<div></div>", props: ["open", "model", "categories"] },
}));
vi.mock("@/components/categories/CategoryManager.vue", () => ({
  default: { template: "<div></div>", props: ["open", "categories"] },
}));
vi.mock("@/components/tags/TagManager.vue", () => ({
  default: { template: "<div></div>", props: ["open", "tags"] },
}));

// Mock vue-router
const mockRoute = { query: {} };
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ replace: vi.fn() }),
}));

// Mock linksApi to prevent real fetch calls when watchers trigger loadLinks
vi.mock("@/services/api/linksApi", () => ({
  linksApi: {
    list: vi
      .fn()
      .mockResolvedValue({ links: [], pagination: { total: 0 }, page: 1 }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

describe("EditLinksView", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    const appStore = useAppStore();
    // Prevent loadLinks from actually calling the API when watchers fire
    vi.spyOn(appStore, "loadLinks").mockResolvedValue();
    appStore.links = [
      { id: 1, title: "Alpha", url: "https://alpha.com", category_id: 1 },
      { id: 2, title: "Beta", url: "https://beta.com", category_id: 2 },
      { id: 3, title: "Gamma", url: "https://gamma.com", category_id: null },
    ];
    appStore.categories = [
      { id: 1, name: "Work" },
      { id: 2, name: "Personal" },
    ];
    appStore.tags = [];
    appStore.total = 3;
    appStore.search = "";
    appStore.filterCategory = "";
  });

  function mountEdit() {
    return mount(EditLinksView, {
      global: {
        plugins: [pinia],
        stubs: { Teleport: true },
      },
    });
  }

  it("shows search input", () => {
    const wrapper = mountEdit();
    const searchInput = wrapper.find('input[type="search"]');
    expect(searchInput.exists()).toBe(true);
    expect(searchInput.attributes("placeholder")).toBe("Search links...");
  });

  it("shows category filter dropdown", () => {
    const wrapper = mountEdit();
    const select = wrapper.find("select");
    expect(select.exists()).toBe(true);
    expect(wrapper.text()).toContain("All Categories");
    expect(wrapper.text()).toContain("Work");
    expect(wrapper.text()).toContain("Personal");
  });

  it("shows pagination info", () => {
    const wrapper = mountEdit();
    expect(wrapper.text()).toContain("Showing 3 of 3 links");
  });

  it("renders action buttons", () => {
    const wrapper = mountEdit();
    expect(wrapper.text()).toContain("+ Add link");
    expect(wrapper.text()).toContain("Categories");
    expect(wrapper.text()).toContain("Tags");
  });

  it("renders link cards", () => {
    const wrapper = mountEdit();
    expect(wrapper.text()).toContain("Alpha");
    expect(wrapper.text()).toContain("Beta");
    expect(wrapper.text()).toContain("Gamma");
  });

  it("shows empty state when no links", () => {
    const appStore = useAppStore();
    appStore.links = [];
    appStore.total = 0;

    const wrapper = mountEdit();
    expect(wrapper.text()).toContain("No links yet");
    expect(wrapper.find(".mdi-link-off").exists()).toBe(true);
  });

  it("shows Load More button when more links available", () => {
    const appStore = useAppStore();
    appStore.total = 100;

    const wrapper = mountEdit();
    expect(wrapper.text()).toContain("Load more");
  });

  it("hides Load More when all links loaded", () => {
    const wrapper = mountEdit();
    expect(wrapper.text()).not.toContain("Load more");
  });

  it("debounces search input to store", async () => {
    vi.useFakeTimers();
    const appStore = useAppStore();
    const wrapper = mountEdit();

    const searchInput = wrapper.find('input[type="search"]');
    await searchInput.setValue("test query");

    // Not synced yet (debounce)
    expect(appStore.search).toBe("");

    vi.advanceTimersByTime(300);
    expect(appStore.search).toBe("test query");

    vi.useRealTimers();
  });

  it("syncs category filter immediately to store", async () => {
    const appStore = useAppStore();
    const wrapper = mountEdit();

    const select = wrapper.find("select");
    await select.setValue(1);

    expect(appStore.filterCategory).toBe(1);
  });
});
