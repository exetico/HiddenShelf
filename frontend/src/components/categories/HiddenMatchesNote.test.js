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
    appStore.hiddenMatches = 2;
    const wrapper = mount(HiddenMatchesNote);
    expect(wrapper.text()).toMatch(/2 more matches\s+in hidden categories/);
    await wrapper.find('[data-testid="toggle-hidden-matches"]').trigger("click");
    expect(appStore.revealHidden).toHaveBeenCalledWith(true);
  });

  it("can leave them out again", async () => {
    appStore.showHidden = true;
    const wrapper = mount(HiddenMatchesNote);
    expect(wrapper.text()).toContain("Including hidden categories");
    await wrapper.find('[data-testid="toggle-hidden-matches"]').trigger("click");
    expect(appStore.revealHidden).toHaveBeenCalledWith(false);
  });
});
