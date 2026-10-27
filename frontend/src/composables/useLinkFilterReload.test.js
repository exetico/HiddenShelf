import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useLinkFilterReload } from "@/composables/useLinkFilterReload";

describe("useLinkFilterReload", () => {
  let store, wrapper;
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    store = useAppStore();
    vi.spyOn(store, "loadLinks").mockResolvedValue();
    wrapper = mount(
      defineComponent({
        setup() {
          useLinkFilterReload();
          return () => h("div");
        },
      }),
    );
  });
  afterEach(() => {
    wrapper.unmount();
    vi.useRealTimers();
  });

  it("reloads at once for a category, and that cancels a pending search", async () => {
    store.search = "git";
    await nextTick();
    store.filterCategory = "3";
    await nextTick();
    expect(store.loadLinks).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(store.loadLinks).toHaveBeenCalledTimes(1);
  });

  it("drops a pending search when the page is left", async () => {
    store.search = "git";
    await nextTick();
    wrapper.unmount();
    vi.advanceTimersByTime(500);
    expect(store.loadLinks).not.toHaveBeenCalled();
    wrapper = mount(defineComponent({ render: () => h("div") }));
  });
});
