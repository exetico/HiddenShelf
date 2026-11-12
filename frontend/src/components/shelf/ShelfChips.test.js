import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useDialogStore } from "@/stores/dialog";
import ShelfChips from "@/components/shelf/ShelfChips.vue";

vi.mock("vue-router", () => ({ useRoute: () => ({ name: "view", query: {} }) }));

describe("ShelfChips", () => {
  let appStore;
  beforeEach(() => {
    setActivePinia(createPinia());
    appStore = useAppStore();
    appStore.saveSavedSearches = vi.fn(async (list) => {
      appStore.settings = { ...appStore.settings, saved_searches: list };
    });
  });

  it("stays away when there's nothing to show", () => {
    expect(mount(ShelfChips).find('[data-testid="shelf-chips"]').exists()).toBe(false);
  });

  it("shows To read with its count and toggles the filter", async () => {
    appStore.allLinks = [
      { id: 1, title: "a", read_later: 1 },
      { id: 2, title: "b", read_later: 1 },
      { id: 3, title: "c", read_later: 0 },
    ];
    const wrapper = mount(ShelfChips);
    const chip = wrapper.find('[data-testid="to-read-chip"]');
    expect(chip.text()).toContain("To read");
    expect(chip.text()).toContain("2");
    await chip.trigger("click");
    expect(appStore.filterToRead).toBe(true);
    expect(appStore.links.map((l) => l.id).sort()).toEqual([1, 2]);
  });

  it("saves the filters that are on under a name", async () => {
    appStore.tags = [{ id: 4, name: "dinner" }];
    appStore.filterTag = "4";
    appStore.search = "weeknight";
    const wrapper = mount(ShelfChips);
    await wrapper.find('[data-testid="save-search"]').trigger("click");
    const dialog = useDialogStore();
    expect(dialog.current.value).toBe("#dinner + weeknight");
    dialog.current.value = "Weeknight dinners";
    dialog.close(true);
    await flushPromises();
    expect(appStore.saveSavedSearches).toHaveBeenCalledWith([
      { name: "Weeknight dinners", query: { tag: "4", q: "weeknight" } },
    ]);
    // Now it's saved and showing, so there's nothing more to save
    expect(wrapper.find('[data-testid="save-search"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="saved-search-0"] a').attributes("aria-current")).toBe("true");
  });

  it("applies a saved search, turns it off again, and removes it after asking", async () => {
    appStore.settings = { saved_searches: [{ name: "Soups", query: { q: "soup" } }] };
    const wrapper = mount(ShelfChips);
    const chip = () => wrapper.find('[data-testid="saved-search-0"] a');
    expect(chip().attributes("href")).toBe("/view?q=soup");

    await chip().trigger("click", { button: 0 });
    expect(appStore.search).toBe("soup");

    await wrapper.find('[data-testid="remove-saved-search"]').trigger("click");
    useDialogStore().close(true);
    await flushPromises();
    expect(appStore.saveSavedSearches).toHaveBeenCalledWith([]);

    appStore.settings = { saved_searches: [{ name: "Soups", query: { q: "soup" } }] };
    await flushPromises();
    await chip().trigger("click", { button: 0 });
    expect(appStore.search).toBe("");
  });
});
