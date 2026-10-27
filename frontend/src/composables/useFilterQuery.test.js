import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, reactive } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useFilterQuery } from "@/composables/useFilterQuery";

const route = reactive({ query: {} });
const replace = vi.fn((to) => {
  route.query = to.query;
});
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ replace }),
}));

const Host = defineComponent({
  setup() {
    useFilterQuery();
    return () => null;
  },
});

describe("useFilterQuery", () => {
  let appStore;
  beforeEach(() => {
    setActivePinia(createPinia());
    appStore = useAppStore();
    appStore.filterByTag = vi.fn((id) => {
      appStore.filterTag = id ? String(id) : "";
    });
    route.query = {};
    replace.mockClear();
  });

  it("applies the filters in the address on arrival", () => {
    route.query = { category: "3", tag: "7", q: "grafana" };
    mount(Host);
    expect(appStore.filterCategory).toBe("3");
    expect(appStore.filterTag).toBe("7");
    expect(appStore.search).toBe("grafana");
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the current filters when the address has none, and writes them in", () => {
    appStore.filterCategory = "3";
    mount(Host);
    expect(appStore.filterCategory).toBe("3");
    expect(replace).toHaveBeenCalledWith({ query: { category: "3" } });
  });

  it("updates the address as filters change, keeping other parameters", async () => {
    route.query = { section: "x" };
    mount(Host);
    appStore.search = "nas";
    appStore.filterTag = "4";
    await nextTick();
    expect(route.query).toEqual({ section: "x", tag: "4", q: "nas" });
    appStore.search = "";
    appStore.filterTag = "";
    await nextTick();
    expect(route.query).toEqual({ section: "x" });
  });

  it("follows the address on Back/Forward or a link to the same page", async () => {
    appStore.settingsLoaded = true;
    mount(Host);
    route.query = { tag: "9" };
    await nextTick();
    expect(appStore.filterByTag).toHaveBeenCalledWith("9");
    route.query = { category: "uncategorized" };
    await nextTick();
    expect(appStore.filterCategory).toBe("uncategorized");
    expect(appStore.filterByTag).toHaveBeenLastCalledWith("");
  });
});
