import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";
import TopNav from "@/components/layout/TopNav.vue";

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => ({ name: "view" }),
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/composables/useTheme", () => ({
  useTheme: () => ({ mode: "dark", toggleTheme: vi.fn() }),
}));

describe("TopNav", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    useAuthStore().user = { email: "t@example.com" };
    mockPush.mockClear();
  });

  const mountNav = () => mount(TopNav, { global: { plugins: [pinia] } });

  it("is 48px tall on phones and 64px from sm up", () => {
    const bar = mountNav().find("header > div");
    expect(bar.classes()).toEqual(expect.arrayContaining(["h-12", "sm:h-16"]));
  });

  it("shows the bookshelf icon as the home button", async () => {
    const wrapper = mountNav();
    const home = wrapper.find('[aria-label="Hidden Shelf home"]');
    expect(home.find(".mdi-bookshelf").exists()).toBe(true);
    await home.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "dashboard" });
  });

  it("keeps View/Edit labels for screen readers on very narrow screens", () => {
    const labels = mountNav().findAll("span.max-\\[359px\\]\\:sr-only");
    expect(labels.map((l) => l.text())).toEqual(["View", "Edit"]);
  });
});
