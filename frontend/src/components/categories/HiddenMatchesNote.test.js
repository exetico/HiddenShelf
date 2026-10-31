import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import HiddenMatchesNote from "@/components/categories/HiddenMatchesNote.vue";

describe("HiddenMatchesNote", () => {
  let appStore;
  beforeEach(() => {
    setActivePinia(createPinia());
    appStore = useAppStore();
    appStore.revealHidden = vi.fn();
  });

  it("stays away when nothing is hidden", () => {
    expect(mount(HiddenMatchesNote).find('[data-testid="hidden-matches"]').exists()).toBe(false);
  });

  it("offers the matches from hidden categories", async () => {
    // A search with two matches in a hidden category
    appStore.categories = [{ id: 5, is_hidden: 1 }];
    appStore.allLinks = [
      { id: 1, title: "nas one", category_id: 5 },
      { id: 2, title: "nas two", category_id: 5 },
    ];
    appStore.search = "nas";
    const wrapper = mount(HiddenMatchesNote);
    expect(wrapper.text()).toMatch(/2 more matches\s+in hidden categories/);
    await wrapper.find('[data-testid="toggle-hidden-matches"]').trigger("click");
    expect(appStore.revealHidden).toHaveBeenCalledWith(true);
  });

  it("can leave them out again", async () => {
    appStore.revealedFor = appStore.filterKey;
    const wrapper = mount(HiddenMatchesNote);
    expect(wrapper.text()).toContain("Including hidden categories");
    await wrapper.find('[data-testid="toggle-hidden-matches"]').trigger("click");
    expect(appStore.revealHidden).toHaveBeenCalledWith(false);
  });
});
