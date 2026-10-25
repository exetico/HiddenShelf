import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import ActiveTagFilter from "@/components/tags/ActiveTagFilter.vue";

describe("ActiveTagFilter", () => {
  let pinia, appStore;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    appStore = useAppStore();
    appStore.tags = [{ id: 4, name: "recipes" }];
    appStore.filterByTag = vi.fn();
  });

  const mountFilter = () =>
    mount(ActiveTagFilter, { global: { plugins: [pinia] } });

  it("renders nothing without a tag filter", () => {
    expect(mountFilter().text()).toBe("");
  });

  it("shows the active tag and clears it on click", async () => {
    appStore.filterTag = "4";
    const wrapper = mountFilter();
    expect(wrapper.text()).toContain("#recipes");
    await wrapper.find("button").trigger("click");
    expect(appStore.filterByTag).toHaveBeenCalledWith("");
  });
});
