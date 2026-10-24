import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import ProfileView from "@/views/ProfileView.vue";

// Mock all API modules
vi.mock("@/services/api/sharesApi", () => ({
  sharesApi: {
    verifyShareCode: vi.fn(),
    listSharedCategories: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/services/api/linksApi", () => ({
  linksApi: { list: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/services/api/categoriesApi", () => ({
  categoriesApi: { remove: vi.fn() },
}));
vi.mock("@/services/api/tagsApi", () => ({
  tagsApi: { remove: vi.fn() },
}));
vi.mock("@/services/api/settingsApi", () => ({
  settingsApi: {
    get: vi
      .fn()
      .mockResolvedValue({ links_per_page: 20, brand_color: "#687061" }),
    update: vi
      .fn()
      .mockResolvedValue({ links_per_page: 20, brand_color: "#687061" }),
  },
}));
vi.mock("@/services/api/configApi", () => ({
  configApi: {
    get: vi
      .fn()
      .mockResolvedValue({ app_version: "1.2.3", site_name: "Hidden Shelf" }),
  },
}));

vi.mock("@/services/api/accountApi", () => ({
  accountApi: { deleteAllData: vi.fn() },
}));
vi.mock("@/services/api/linkVisitsApi", () => ({
  linkVisitsApi: { getSummary: vi.fn().mockResolvedValue({ total_visits: 0, days: 30, summary: [] }) },
}));

import { sharesApi } from "@/services/api/sharesApi";

describe("ProfileView", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    const authStore = useAuthStore();
    authStore.user = { email: "test@example.com" };
    const appStore = useAppStore();
    appStore.settings = { links_per_page: 20, brand_color: "#687061" };
    appStore.appConfig = { app_version: "1.2.3", site_name: "Hidden Shelf" };
    appStore.total = 10;
    appStore.categories = [{ id: 1, name: "Cat" }];
    appStore.tags = [{ id: 1, name: "Tag" }];
    appStore.sharedCategories = [];
  });

  function mountProfile() {
    return mount(ProfileView, {
      global: {
        plugins: [pinia],
        stubs: {
          Teleport: true,
          ImportExportModal: true,
        },
      },
    });
  }

  it("shows beta notice", () => {
    const wrapper = mountProfile();
    expect(wrapper.text()).toContain("Beta notice");
    expect(wrapper.text()).toContain("export your data");
  });

  it("displays user email", () => {
    const wrapper = mountProfile();
    expect(wrapper.text()).toContain("test@example.com");
  });

  it("displays app version", () => {
    const wrapper = mountProfile();
    expect(wrapper.text()).toContain("Hidden Shelf v1.2.3");
  });

  it("hides app version when not available", () => {
    const appStore = useAppStore();
    appStore.appConfig = { app_version: "", site_name: "Hidden Shelf" };
    const wrapper = mountProfile();
    expect(wrapper.text()).not.toContain("Hidden Shelf v");
  });

  it("shows verify button for share code input", () => {
    const wrapper = mountProfile();
    const verifyBtn = wrapper
      .findAll("button")
      .filter((b) => b.text().includes("Verify"));
    expect(verifyBtn.length).toBeGreaterThan(0);
  });

  it("shows share code input with URL placeholder", () => {
    const wrapper = mountProfile();
    const input = wrapper.find('input[placeholder="Share code or URL"]');
    expect(input.exists()).toBe(true);
  });

  it("shows error on invalid share code verification", async () => {
    sharesApi.verifyShareCode.mockRejectedValue(new Error("Invalid code"));

    const wrapper = mountProfile();
    const input = wrapper.find('input[placeholder="Share code or URL"]');
    await input.setValue("badcode");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Invalid code");
  });

  it("shows join preview modal on successful verification", async () => {
    sharesApi.verifyShareCode.mockResolvedValue({
      category_name: "Shared Links",
      icon: "mdi-folder",
      color: "#ff0000",
      owner_email: "owner@example.com",
      link_count: 42,
    });

    const wrapper = mountProfile();
    const input = wrapper.find('input[placeholder="Share code or URL"]');
    await input.setValue("abc123");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Join Shared Category");
    expect(wrapper.text()).toContain("Shared Links");
    expect(wrapper.text()).toContain("owner@example.com");
    expect(wrapper.text()).toContain("42 links");
  });

  it("extracts share code from full URL", async () => {
    sharesApi.verifyShareCode.mockResolvedValue({
      category_name: "Test",
      owner_email: "x@y.com",
      link_count: 1,
    });

    const wrapper = mountProfile();
    const input = wrapper.find('input[placeholder="Share code or URL"]');
    await input.setValue(
      "https://example.com/public/app/index.html#/login?share=mycode123",
    );
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(sharesApi.verifyShareCode).toHaveBeenCalledWith("mycode123");
  });

  it("shows Danger Zone toggle button", () => {
    const wrapper = mountProfile();
    expect(wrapper.text()).toContain("Danger Zone");
  });

  it("shows Delete Everything button after expanding Danger Zone", async () => {
    const wrapper = mountProfile();
    // Click Danger Zone  toggle
    const dangerButton = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Danger Zone"));
    await dangerButton.trigger("click");

    expect(wrapper.text()).toContain("Delete Everything");
  });

  it("opens Delete Everything modal instead of window.prompt", async () => {
    const wrapper = mountProfile();

    // Expand danger zone
    const dangerBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Danger Zone"));
    await dangerBtn.trigger("click");

    // Click Delete Everything
    const deleteBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Delete Everything");
    await deleteBtn.trigger("click");

    // Should show the modal with confirmation input
    expect(wrapper.text()).toContain("delete 12 now");
    expect(
      wrapper
        .find('input[placeholder="Type the confirmation phrase..."]')
        .exists(),
    ).toBe(true);
  });

  it("lists shared categories with leave buttons", () => {
    const appStore = useAppStore();
    appStore.sharedCategories = [
      { id: 5, name: "Shared Stuff", owner_email: "friend@example.com" },
    ];

    const wrapper = mountProfile();
    expect(wrapper.text()).toContain("Shared Stuff");
    expect(wrapper.text()).toContain("friend@example.com");

    const leaveBtn = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Leave");
    expect(leaveBtn.length).toBeGreaterThan(0);
  });
});
