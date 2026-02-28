import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { useAppStore } from "@/stores/app";
import DashboardView from "@/views/DashboardView.vue";

// Mock useTheme composable — isDark must be a real ref for template reactivity
const mockIsDark = ref(false);
const mockToggleTheme = vi.fn();
vi.mock("@/composables/useTheme", () => ({
  useTheme: () => ({
    isDark: mockIsDark,
    toggleTheme: mockToggleTheme,
  }),
}));

// Mock vue-router
const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("DashboardView", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    const appStore = useAppStore();
    appStore.total = 42;
    appStore.categories = [{ id: 1 }, { id: 2 }];
    appStore.tags = [{ id: 1 }, { id: 2 }, { id: 3 }];
    appStore.links = [];
    mockPush.mockClear();
    mockIsDark.value = false;
    mockToggleTheme.mockClear();
  });

  function mountDashboard() {
    return mount(DashboardView, {
      global: { plugins: [pinia] },
    });
  }

  it("shows welcome message", () => {
    const wrapper = mountDashboard();
    expect(wrapper.text()).toContain("Welcome back");
  });

  it("displays stats for links, categories, and tags", () => {
    const wrapper = mountDashboard();
    expect(wrapper.text()).toContain("42"); // links
    expect(wrapper.text()).toContain("2"); // categories
    expect(wrapper.text()).toContain("3"); // tags
  });

  it("renders 4 quick action buttons", () => {
    const wrapper = mountDashboard();
    expect(wrapper.text()).toContain("View links");
    expect(wrapper.text()).toContain("Edit links");
    expect(wrapper.text()).toContain("Profile");
    expect(wrapper.text()).toContain("Import Data");
  });

  it("navigates to view links on click", async () => {
    const wrapper = mountDashboard();
    const viewBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("View links"));
    await viewBtn.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "view" });
  });

  it("navigates to edit links on click", async () => {
    const wrapper = mountDashboard();
    const editBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Edit links"));
    await editBtn.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "edit" });
  });

  it("navigates to profile on Import Data click", async () => {
    const wrapper = mountDashboard();
    const importBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Import Data"));
    await importBtn.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "profile" });
  });

  it("shows theme toggle section", () => {
    const wrapper = mountDashboard();
    expect(wrapper.text()).toContain("Theme");
    expect(wrapper.text()).toContain("Light mode");
  });

  it("shows theme toggle button", () => {
    const wrapper = mountDashboard();
    const themeBtn = wrapper.find('button[title="Switch to dark mode"]');
    expect(themeBtn.exists()).toBe(true);
  });
});
