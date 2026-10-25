import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import CategoryPicker from "@/components/categories/CategoryPicker.vue";
import CategoryFilterBar from "@/components/categories/CategoryFilterBar.vue";

vi.mock("@/services/api/categoriesApi", () => ({
  categoriesApi: {
    update: vi.fn().mockResolvedValue({}),
    reorder: vi.fn().mockResolvedValue({}),
  },
}));

import { categoriesApi } from "@/services/api/categoriesApi";

describe("CategoryPicker", () => {
  let pinia, appStore;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    appStore = useAppStore();
    appStore.categories = [
      { id: 1, name: "Work", link_count: 3, is_favorite: 0 },
      { id: 2, name: "Home", link_count: 2, is_favorite: 1 },
    ];
    appStore.total = 5;
    vi.clearAllMocks();
  });

  function mountPicker() {
    return mount(CategoryPicker, {
      global: { plugins: [pinia], stubs: { Teleport: true } },
    });
  }

  it("shows the current selection on the button", () => {
    appStore.filterCategory = "2";
    expect(mountPicker().text()).toContain("Home");
  });

  it("lists favorites in their own section and selects a category", async () => {
    const wrapper = mountPicker();
    await wrapper.find("button").trigger("click");
    const text = wrapper.text();
    expect(text.indexOf("Favorites")).toBeLessThan(text.indexOf("Home"));
    expect(text.indexOf("Home")).toBeLessThan(text.indexOf("Work"));

    const work = wrapper.findAll("button").find((b) => b.text().startsWith("Work"));
    await work.trigger("click");
    expect(appStore.filterCategory).toBe("1");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("toggles a favorite from the sheet", async () => {
    const wrapper = mountPicker();
    await wrapper.find("button").trigger("click");
    await wrapper.find('[aria-label="Add Work to favorites"]').trigger("click");
    expect(categoriesApi.update).toHaveBeenCalledWith(1, { is_favorite: true });
    expect(appStore.categories[0].is_favorite).toBe(1);
  });

  it("moveCategory swaps order and saves it", async () => {
    await appStore.moveCategory(appStore.categories[1], "up");
    expect(appStore.categories.map((c) => c.id)).toEqual([2, 1]);
    expect(categoriesApi.reorder).toHaveBeenCalledWith([2, 1]);
  });

  it("desktop bar lists favorites first and has a star on each category", async () => {
    const wrapper = mount(CategoryFilterBar, { global: { plugins: [pinia] } });
    const text = wrapper.text();
    expect(text.indexOf("Home")).toBeLessThan(text.indexOf("Work"));
    await wrapper.find('[aria-label="Add Work to favorites"]').trigger("click");
    expect(categoriesApi.update).toHaveBeenCalledWith(1, { is_favorite: true });
  });
});
