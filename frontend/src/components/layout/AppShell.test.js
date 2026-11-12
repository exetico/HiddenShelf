import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import AppShell from "@/components/layout/AppShell.vue";
import FloatingSearch from "@/components/layout/FloatingSearch.vue";

const mockPush = vi.fn();
const mockRoute = { name: "dashboard" };
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: mockPush }),
}));

describe("Floating search bar", () => {
  let pinia;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    mockPush.mockClear();
    mockRoute.name = "dashboard";
  });

  const mountShell = () =>
    mount(AppShell, { global: { plugins: [pinia], stubs: { TopNav: true } } });

  it("is off by default", () => {
    const wrapper = mountShell();
    expect(wrapper.find('[data-testid="floating-search"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="app-main"]').classes()).not.toContain("max-md:pb-24");
  });

  it("only turns on for a real true", () => {
    for (const value of ["true", 1, "yes", null]) {
      useAppStore().settings = { floating_search: value };
      expect(mountShell().find('[data-testid="floating-search"]').exists()).toBe(false);
    }
  });

  it("floats at the bottom on phones, blurred and rounded, with room left for it", () => {
    useAppStore().settings = { floating_search: true };
    const wrapper = mountShell();
    const bar = wrapper.find('[data-testid="floating-search"]');
    expect(bar.classes()).toEqual(expect.arrayContaining(["md:hidden", "fixed", "bottom-0"]));
    expect(bar.find("div").classes()).toEqual(
      expect.arrayContaining(["backdrop-blur-xl", "rounded-2xl"]),
    );
    expect(wrapper.find('[data-testid="app-main"]').classes()).toContain("max-md:pb-24");
  });

  it("searches the shelf and jumps to View from other pages", async () => {
    const wrapper = mount(FloatingSearch, { global: { plugins: [pinia] } });
    await wrapper.find('[data-testid="floating-search-input"]').setValue("tesla");
    expect(useAppStore().search).toBe("tesla");
    expect(mockPush).toHaveBeenCalledWith({ name: "view" });
  });

  it("stays on View or Edit while you type there", async () => {
    mockRoute.name = "edit";
    const wrapper = mount(FloatingSearch, { global: { plugins: [pinia] } });
    await wrapper.find('[data-testid="floating-search-input"]').setValue("tesla");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("uses 16px text so iPhones don't zoom in", () => {
    const wrapper = mount(FloatingSearch, { global: { plugins: [pinia] } });
    expect(wrapper.find("input").classes()).toContain("text-base");
  });
});
