import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import EditLinksView from "@/views/EditLinksView.vue";

// Mock child components
vi.mock("@/components/links/LinkCardEdit.vue", () => ({
  default: {
    name: "LinkCardEdit",
    template: '<div class="link-card">{{ link.title }}</div>',
    props: ["link"],
    emits: ["edit", "delete"],
  },
}));
vi.mock("@/components/links/LinkFormModal.vue", () => ({
  default: {
    name: "LinkFormModal",
    template: "<div></div>",
    props: ["open", "model", "categories"],
  },
}));
vi.mock("@/components/links/TrashModal.vue", () => ({
  default: { name: "TrashModal", template: "<div></div>", props: ["open"] },
}));
vi.mock("@/components/categories/CategoryManager.vue", () => ({
  default: { name: "CategoryManager", template: "<div></div>", props: ["open", "categories"] },
}));
vi.mock("@/components/tags/TagManager.vue", () => ({
  default: { name: "TagManager", template: "<div></div>", props: ["open", "tags"] },
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
    expect(wrapper.text()).toContain("Manage categories");
    expect(wrapper.text()).toContain("Manage tags");
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

  it("searches once typing pauses, not on every key", async () => {
    vi.useFakeTimers();
    const appStore = useAppStore();
    const wrapper = mountEdit();
    await flushPromises();
    appStore.loadLinks.mockClear();

    const searchInput = wrapper.find('input[type="search"]');
    for (const text of ["g", "gi", "git"]) {
      await searchInput.setValue(text);
      vi.advanceTimersByTime(100);
    }
    // The box and the top bar share the text right away...
    expect(appStore.search).toBe("git");
    // ...but nothing is fetched until 300ms after the last key
    expect(appStore.loadLinks).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(appStore.loadLinks).toHaveBeenCalledTimes(1);

    // Trailing spaces give the same results: no request
    await searchInput.setValue("git ");
    vi.advanceTimersByTime(300);
    expect(appStore.loadLinks).toHaveBeenCalledTimes(1);

    // Clearing shows everything again at once
    await searchInput.setValue("");
    expect(appStore.loadLinks).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    vi.useRealTimers();
  });

  it("leaves the first load to start-up until settings are in", async () => {
    const appStore = useAppStore();
    appStore.links = [];
    appStore.settingsLoaded = false;
    mountEdit();
    await flushPromises();
    // Start-up loads with the user's page size; loading here would use 20
    expect(appStore.loadLinks).not.toHaveBeenCalled();

    appStore.settingsLoaded = true;
    mountEdit();
    await flushPromises();
    expect(appStore.loadLinks).toHaveBeenCalledWith({ reset: true });
  });

  it("syncs category filter immediately to store", async () => {
    const appStore = useAppStore();
    const wrapper = mountEdit();

    const select = wrapper.find("select");
    await select.setValue(1);

    expect(appStore.filterCategory).toBe(1);
  });

  it("opens the new-link form when sent here by the top bar's Add link", async () => {
    mockRoute.query = { new: "1" };
    const wrapper = mountEdit();
    await flushPromises();
    const form = wrapper.findComponent({ name: "LinkFormModal" });
    expect(form.props("open")).toBe(true);
    expect(form.props("model")).toEqual({ category_id: "", tags: [] });
    mockRoute.query = {};
  });

  it("starts a new link in the category and tag the list is filtered by", async () => {
    const appStore = useAppStore();
    appStore.filterCategory = 2;
    appStore.tags = [{ id: 7, name: "infra" }];
    appStore.filterTag = "7";
    const wrapper = mountEdit();
    await wrapper.find('[data-testid="add-link"]').trigger("click");
    const form = wrapper.findComponent({ name: "LinkFormModal" });
    expect(form.props("open")).toBe(true);
    expect(form.props("model")).toEqual({ category_id: 2, tags: [{ name: "infra" }] });
  });

  it("starts a new link without a category when filtered on Uncategorized", async () => {
    const appStore = useAppStore();
    appStore.filterCategory = "uncategorized";
    const wrapper = mountEdit();
    await wrapper.find('[data-testid="add-link"]').trigger("click");
    expect(wrapper.findComponent({ name: "LinkFormModal" }).props("model").category_id).toBe("");
  });

  it("fills in the page the bookmarklet was clicked on", async () => {
    mockRoute.query = { new: "1", url: "https://news.example/a", title: "News" };
    const wrapper = mountEdit();
    await flushPromises();
    const form = wrapper.findComponent({ name: "LinkFormModal" });
    expect(form.props("open")).toBe(true);
    // No id: it's still a new link, just filled in
    expect(form.props("model")).toEqual({
      url: "https://news.example/a",
      title: "News",
      category_id: "",
      tags: [],
    });
    mockRoute.query = {};
  });

  it("follows the top bar's search", async () => {
    const appStore = useAppStore();
    const wrapper = mountEdit();
    appStore.search = "beta";
    await flushPromises();
    expect(wrapper.find('[data-testid="page-search"]').element.value).toBe("beta");
  });

  it("opens the trash", async () => {
    const wrapper = mountEdit();
    await wrapper.find('[data-testid="open-trash"]').trigger("click");
    expect(wrapper.findComponent({ name: "TrashModal" }).props("open")).toBe(true);
  });

  it("asks before a card's Delete moves the link to the trash", async () => {
    const appStore = useAppStore();
    appStore.trashLink = vi.fn().mockResolvedValue(true);
    const wrapper = mountEdit();
    wrapper.findAllComponents({ name: "LinkCardEdit" })[1].vm.$emit("delete", 2);
    await flushPromises();
    expect(appStore.trashLink).toHaveBeenCalledWith(expect.objectContaining({ id: 2, title: "Beta" }));
  });

  it("labels the managers as managers, with the same look", () => {
    const wrapper = mountEdit();
    const categories = wrapper.find('[data-testid="open-categories"]');
    const tags = wrapper.find('[data-testid="open-tags"]');
    // "Manage …" from sm up; just the name on phones
    expect(categories.text()).toContain("Manage categories");
    expect(tags.text()).toContain("Manage tags");
    expect(categories.find(".sm\\:hidden").text()).toBe("Categories");
    expect(categories.classes()).toEqual(tags.classes());
  });

  it("refreshes link counts when a manager opens", async () => {
    const appStore = useAppStore();
    appStore.loadCategories = vi.fn().mockResolvedValue();
    appStore.loadTags = vi.fn().mockResolvedValue();
    const wrapper = mountEdit();
    await wrapper.find('[data-testid="open-tags"]').trigger("click");
    expect(appStore.loadTags).toHaveBeenCalled();
    expect(wrapper.findComponent({ name: "TagManager" }).props("open")).toBe(true);
    await wrapper.find('[data-testid="open-categories"]').trigger("click");
    expect(appStore.loadCategories).toHaveBeenCalled();
  });

  it("picking a tag or category in its manager filters the list", async () => {
    const appStore = useAppStore();
    appStore.loadCategories = vi.fn().mockResolvedValue();
    appStore.loadTags = vi.fn().mockResolvedValue();
    appStore.filterByTag = vi.fn();
    const wrapper = mountEdit();

    await wrapper.find('[data-testid="open-tags"]').trigger("click");
    wrapper.findComponent({ name: "TagManager" }).vm.$emit("filter", 7);
    await flushPromises();
    expect(appStore.filterByTag).toHaveBeenCalledWith(7);
    expect(wrapper.findComponent({ name: "TagManager" }).props("open")).toBe(false);

    await wrapper.find('[data-testid="open-categories"]').trigger("click");
    wrapper.findComponent({ name: "CategoryManager" }).vm.$emit("filter", 2);
    await flushPromises();
    expect(appStore.filterCategory).toBe(2);
    expect(wrapper.find('[data-testid="category-filter"]').element.value).toBe("2");
    expect(wrapper.findComponent({ name: "CategoryManager" }).props("open")).toBe(false);
  });

  it("shows a toast when renaming a tag fails", async () => {
    const appStore = useAppStore();
    appStore.renameTag = vi.fn().mockRejectedValue(new Error('You already have a tag named "x"'));
    const wrapper = mountEdit();
    wrapper.findComponent({ name: "TagManager" }).vm.$emit("rename", 7, "x");
    await flushPromises();
    expect(useToastStore().items.at(-1)).toMatchObject({ message: 'You already have a tag named "x"' });
  });

  it("marks hidden categories in the category filter", () => {
    const appStore = useAppStore();
    appStore.categories = [{ id: 1, name: "Work" }, { id: 2, name: "Friend", is_hidden: 1 }];
    const options = mountEdit().findAll('[data-testid="category-filter"] option').map((o) => o.text());
    expect(options).toEqual(["All Categories", "Work", "Friend (hidden)"]);
  });

  it("keeps the category filter and every button in one bar, in order", () => {
    const bar = mountEdit().find('[data-testid="edit-toolbar"]');
    const ids = bar
      .findAll("[data-testid]")
      .map((el) => el.attributes("data-testid"))
      .filter((id) => ["category-filter", "add-link", "open-categories", "open-tags", "open-trash"].includes(id));
    expect(ids).toEqual(["category-filter", "add-link", "open-categories", "open-tags", "open-trash"]);
    // Trash looks like the managers: outlined, no fill, pushed to the end
    const trash = bar.find('[data-testid="open-trash"]').classes();
    const tags = bar.find('[data-testid="open-tags"]').classes();
    expect(trash).toEqual(expect.arrayContaining([...tags, "ml-auto"]));
    expect(tags).toContain("border");
    expect(tags.some((c) => c.startsWith("bg-"))).toBe(false);
  });
});
