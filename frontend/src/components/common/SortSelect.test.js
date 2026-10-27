import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import SortSelect from "@/components/common/SortSelect.vue";

describe("SortSelect", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("offers date, title and visits, and sets the store's sort", async () => {
    const wrapper = mount(SortSelect);
    const select = wrapper.find('[data-testid="sort-select"]');
    expect(select.findAll("option").map((o) => o.text())).toEqual([
      "Your order",
      "Newest first",
      "Oldest first",
      "Title A–Z",
      "Title Z–A",
      "Most visited",
    ]);
    await select.setValue("visits");
    expect(useAppStore().sort).toBe("visits");
  });
});
