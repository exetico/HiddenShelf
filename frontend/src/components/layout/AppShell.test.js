import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
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
    expect(bar.classes()).toEqual(expect.arrayContaining(["md:hidden", "fixed", "inset-x-2"]));
    // Nothing fixed may touch the bottom edge: iPhone Safari tints its
    // toolbar from such a layer (a black strip under the bar)
    expect(bar.classes()).not.toContain("bottom-0");
    expect(bar.classes()).not.toContain("inset-x-0");
    expect(bar.classes().some((c) => c.startsWith("bottom-[max(0.5rem"))).toBe(true);
    expect(bar.find("div").classes()).toEqual(
      expect.arrayContaining(["backdrop-blur-2xl", "rounded-2xl"]),
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

  describe("when it shows", () => {
    let wrapper;
    const bar = () => wrapper.find('[data-testid="floating-search"]');
    const shown = () => bar().attributes("data-hidden") !== "true";
    async function scrollTo(y) {
      window.scrollY = y;
      window.dispatchEvent(new Event("scroll"));
      await vi.advanceTimersByTimeAsync(20); // the next animation frame
      await nextTick();
    }

    beforeEach(() => {
      vi.useFakeTimers();
      window.scrollY = 0;
      wrapper = mount(FloatingSearch, { global: { plugins: [pinia] }, attachTo: document.body });
    });
    afterEach(() => {
      wrapper.unmount();
      window.scrollY = 0;
      vi.useRealTimers();
    });

    it("is there at the top of the page, so it's there when the page loads", () => {
      expect(shown()).toBe(true);
    });

    it("hides while you scroll down and doesn't pop back mid-page on scroll up", async () => {
      await scrollTo(400);
      expect(shown()).toBe(false);
      expect(bar().attributes("aria-hidden")).toBe("true");
      await scrollTo(250);
      expect(shown()).toBe(false);
      await scrollTo(0);
      expect(shown()).toBe(true);
    });

    it("comes up when focused (the top bar's magnifier) and stays while you type", async () => {
      await scrollTo(400);
      wrapper.find("input").element.focus();
      await nextTick();
      expect(shown()).toBe(true);
      await scrollTo(900);
      expect(shown()).toBe(true);
      // Done typing: the next scroll down tucks it away again
      wrapper.find("input").element.blur();
      await nextTick();
      await scrollTo(1200);
      expect(shown()).toBe(false);
    });

    it("ignores taps for a moment after it slides in", async () => {
      await scrollTo(400);
      expect(bar().classes()).toContain("pointer-events-none");
      await scrollTo(0);
      expect(bar().classes()).toContain("pointer-events-none");
      await vi.advanceTimersByTimeAsync(450);
      expect(bar().classes()).toContain("pointer-events-auto");
    });

    it("is one see-through bar, not a box inside a box", () => {
      const input = wrapper.find("input").classes();
      expect(input).toEqual(expect.arrayContaining(["border-0!", "bg-transparent!"]));
    });

    it("shows Done only while typing, and Done closes the keyboard", async () => {
      const input = wrapper.find("input").element;
      expect(wrapper.find('[data-testid="floating-search-done"]').exists()).toBe(false);
      input.focus();
      await nextTick();
      const done = wrapper.find('[data-testid="floating-search-done"]');
      expect(done.attributes("title")).toBeTruthy();
      // Pressing it doesn't take the focus away first (it would vanish)
      const down = new Event("mousedown", { cancelable: true, bubbles: true });
      done.element.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      await done.trigger("click");
      expect(document.activeElement).not.toBe(input);
      await nextTick();
      expect(wrapper.find('[data-testid="floating-search-done"]').exists()).toBe(false);
    });

    it("closes the keyboard on its search key too", async () => {
      const input = wrapper.find("input");
      expect(input.attributes("enterkeyhint")).toBe("search");
      input.element.focus();
      await input.trigger("keydown", { key: "Enter" });
      expect(document.activeElement).not.toBe(input.element);
    });

    it("focuses on a tap without scrolling the page", async () => {
      const input = wrapper.find("input").element;
      const focus = vi.spyOn(input, "focus");
      const down = new Event("pointerdown", { cancelable: true, bubbles: true });
      input.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });

    it("undoes a scroll the browser makes while the keyboard opens", async () => {
      window.scrollY = 0;
      const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
      wrapper.find("input").element.focus();
      await nextTick();
      window.scrollY = 300;
      window.dispatchEvent(new Event("scroll"));
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
      scrollTo.mockClear();
      // Later scrolling is yours: left alone
      await vi.advanceTimersByTimeAsync(900);
      window.scrollY = 500;
      window.dispatchEvent(new Event("scroll"));
      expect(scrollTo).not.toHaveBeenCalled();
      scrollTo.mockRestore();
    });

    it("sits on top of the keyboard while typing", async () => {
      const vv = new EventTarget();
      Object.assign(vv, { height: 400, offsetTop: 0 });
      const original = window.visualViewport;
      Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
      window.innerHeight = 740;
      wrapper.unmount();
      wrapper = mount(FloatingSearch, { global: { plugins: [pinia] }, attachTo: document.body });
      wrapper.find("input").element.focus();
      await nextTick();
      expect(bar().attributes("style")).toContain("bottom: 348px");
      wrapper.find("input").element.blur();
      await nextTick();
      expect(bar().attributes("style") || "").not.toContain("bottom");
      Object.defineProperty(window, "visualViewport", { value: original, configurable: true });
    });
  });
});
