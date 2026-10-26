import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import TopNav from "@/components/layout/TopNav.vue";

const mockPush = vi.fn();
const mockRoute = { name: "view" };
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
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
    mockRoute.name = "view";
    localStorage.clear();
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

  describe("View/Edit switch", () => {
    const thumb = (w) => w.find('[data-testid="mode-thumb"]');
    const modeButtons = (w) =>
      w.findAll('[role="group"] button').map((b) => ({
        text: b.text(),
        current: b.attributes("aria-current"),
      }));

    it("marks the page you are on", () => {
      mockRoute.name = "edit";
      const wrapper = mountNav();
      expect(modeButtons(wrapper)).toEqual([
        { text: "View", current: undefined },
        { text: "Edit", current: "page" },
      ]);
      expect(thumb(wrapper).classes()).toEqual(
        expect.arrayContaining(["translate-x-full", "bg-brand-600"]),
      );
    });

    it("still shows the last mode, dimmed, on other pages", () => {
      mockRoute.name = "edit";
      mountNav().unmount(); // remembers "edit"
      mockRoute.name = "dashboard";
      const wrapper = mountNav();
      expect(thumb(wrapper).classes()).toContain("translate-x-full");
      expect(thumb(wrapper).classes()).not.toContain("bg-brand-600");
      expect(modeButtons(wrapper).every((b) => !b.current)).toBe(true);
    });

    it("defaults to View when nothing is remembered", () => {
      mockRoute.name = "profile";
      expect(thumb(mountNav()).classes()).toContain("translate-x-0");
    });

    it("switches mode on click", async () => {
      const wrapper = mountNav();
      await wrapper.findAll('[role="group"] button')[1].trigger("click");
      expect(mockPush).toHaveBeenCalledWith({ name: "edit" });
    });
  });

  it("has a hover title on every button", () => {
    const buttons = mountNav().findAll("button");
    expect(buttons.filter((b) => !b.attributes("title"))).toEqual([]);
  });

  it("flips to the other mode when you tap the one you're on", async () => {
    mockRoute.name = "edit";
    const wrapper = mountNav();
    const [view, edit] = wrapper.findAll('[role="group"] button');
    expect(edit.attributes("title")).toBe("Switch to View");
    await edit.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "view" });
    mockPush.mockClear();
    await view.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "view" });
  });

  it("stays at the top while you scroll", () => {
    expect(mountNav().find("header").classes()).toEqual(
      expect.arrayContaining(["sticky", "top-0", "z-30"]),
    );
  });

  describe("desktop tools", () => {
    it("are only in the bar from md up", () => {
      const tools = mountNav().find('[data-testid="nav-tools"]');
      expect(tools.classes()).toEqual(expect.arrayContaining(["hidden", "md:flex"]));
    });

    it("searches in place on View", async () => {
      const wrapper = mountNav();
      await wrapper.find('[data-testid="nav-search"]').setValue("grafana");
      expect(useAppStore().search).toBe("grafana");
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("jumps to View when you search from the dashboard", async () => {
      mockRoute.name = "dashboard";
      const wrapper = mountNav();
      await wrapper.find('[data-testid="nav-search"]').setValue("docs");
      expect(useAppStore().search).toBe("docs");
      expect(mockPush).toHaveBeenCalledWith({ name: "view" });
    });

    it("clears the search on Escape", async () => {
      const wrapper = mountNav();
      const input = wrapper.find('[data-testid="nav-search"]');
      await input.setValue("x");
      await input.trigger("keydown", { key: "Escape" });
      expect(useAppStore().search).toBe("");
    });

    it("opens the new-link form from Add link", async () => {
      const wrapper = mountNav();
      await wrapper.find('[data-testid="nav-add"]').trigger("click");
      expect(mockPush).toHaveBeenCalledWith({ name: "edit", query: { new: "1" } });
    });

    it("focuses the search on / unless you're typing", async () => {
      const wrapper = mountNav();
      const input = wrapper.find('[data-testid="nav-search"]').element;
      // jsdom has no layout, so pretend the box is visible
      Object.defineProperty(input, "offsetParent", { value: document.body });
      const event = new KeyboardEvent("keydown", { key: "/", cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);

      const other = document.createElement("textarea");
      document.body.appendChild(other);
      const typing = new KeyboardEvent("keydown", { key: "/", cancelable: true, bubbles: true });
      other.dispatchEvent(typing);
      expect(typing.defaultPrevented).toBe(false);
      other.remove();
      wrapper.unmount();
    });
  });
});
