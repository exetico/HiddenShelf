import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import CategoryManager from "@/components/categories/CategoryManager.vue";

// Mock sharesApi
vi.mock("@/services/api/sharesApi", () => ({
  sharesApi: {
    getCategoryShare: vi.fn(),
    createCategoryShare: vi.fn(),
    removeMember: vi.fn(),
    removeSharing: vi.fn(),
  },
}));

import { sharesApi } from "@/services/api/sharesApi";

const testCategories = [
  {
    id: 1,
    name: "Work",
    icon: "mdi-briefcase",
    color: "#ff0000",
    link_count: 5,
  },
  {
    id: 2,
    name: "Personal",
    icon: "mdi-home",
    color: "#00ff00",
    link_count: 3,
  },
];

describe("CategoryManager", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountManager(props = {}) {
    return mount(CategoryManager, {
      global: {
        plugins: [pinia],
        stubs: {
          Teleport: true,
          BaseModal: {
            template: '<div v-if="open"><slot /></div>',
            props: ["open", "title"],
          },
        },
      },
      props: {
        open: true,
        categories: testCategories,
        ...props,
      },
    });
  }

  it("renders category list", () => {
    const wrapper = mountManager();
    expect(wrapper.text()).toContain("Work");
    expect(wrapper.text()).toContain("Personal");
  });

  it("shows link count for categories", () => {
    const wrapper = mountManager();
    expect(wrapper.text()).toContain("5 links");
    expect(wrapper.text()).toContain("3 links");
  });

  it("emits create event on form submit", async () => {
    const wrapper = mountManager();

    // Open create form first (hidden by default)
    const addBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Add category"));
    await addBtn.trigger("click");

    await wrapper
      .find('input[placeholder="Category name"]')
      .setValue("New Cat");
    await wrapper.find("form").trigger("submit");

    expect(wrapper.emitted("create")).toHaveLength(1);
    expect(wrapper.emitted("create")[0][0].name).toBe("New Cat");
  });

  it("emits remove event after delete confirmation", async () => {
    const wrapper = mountManager();

    // Click delete button on first category
    const deleteButtons = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Delete");
    await deleteButtons[0].trigger("click");

    // Confirm delete in the modal
    const confirmButton = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Delete");
    // The last "Delete" button should be in the confirmation modal
    await confirmButton[confirmButton.length - 1].trigger("click");

    expect(wrapper.emitted("remove")).toBeTruthy();
  });

  it("enters edit mode when Edit is clicked", async () => {
    const wrapper = mountManager();

    const editButtons = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Edit");
    await editButtons[0].trigger("click");

    // Should now show Save and Cancel buttons
    expect(wrapper.text()).toContain("Save");
    expect(wrapper.text()).toContain("Cancel");
  });

  it("displays shared-with-me section when shared categories exist", () => {
    const appStore = useAppStore();
    appStore.sharedCategories = [
      {
        id: 10,
        name: "Shared Work",
        owner_email: "other@example.com",
        icon: "mdi-folder",
        color: "#333",
      },
    ];

    const wrapper = mountManager();
    expect(wrapper.text()).toContain("Shared with me");
    expect(wrapper.text()).toContain("Shared Work");
    expect(wrapper.text()).toContain("other@example.com");
  });

  it("hides shared-with-me section when no shared categories", () => {
    const appStore = useAppStore();
    appStore.sharedCategories = [];

    const wrapper = mountManager();
    expect(wrapper.text()).not.toContain("Shared with me");
  });

  it("shows leave button for shared categories", () => {
    const appStore = useAppStore();
    appStore.sharedCategories = [
      { id: 10, name: "Shared", owner_email: "x@y.com" },
    ];

    const wrapper = mountManager();
    const leaveBtn = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Leave");
    expect(leaveBtn.length).toBeGreaterThan(0);
  });

  describe("order and favorites", () => {
    it("disables moving the first category up and the last one down", () => {
      const wrapper = mountManager();
      expect(
        wrapper.find('[aria-label="Move Work up"]').attributes("disabled"),
      ).toBeDefined();
      expect(
        wrapper.find('[aria-label="Move Personal down"]').attributes("disabled"),
      ).toBeDefined();
      expect(
        wrapper.find('[aria-label="Move Work down"]').attributes("disabled"),
      ).toBeUndefined();
    });

    it("moves a category and toggles a favorite through the store", async () => {
      const appStore = useAppStore();
      appStore.moveCategory = vi.fn();
      appStore.toggleFavorite = vi.fn();
      const wrapper = mountManager();

      await wrapper.find('[aria-label="Move Work down"]').trigger("click");
      expect(appStore.moveCategory).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        "down",
      );

      await wrapper.find('[aria-label="Add Personal to favorites"]').trigger("click");
      expect(appStore.toggleFavorite).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2 }),
      );
    });
  });
});
