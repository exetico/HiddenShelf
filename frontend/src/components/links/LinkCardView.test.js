import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import LinkCardView from "@/components/links/LinkCardView.vue";

const link = {
  id: 3,
  title: "Grafana",
  url: "https://grafana.example.com",
  tags: [{ id: 9, name: "infra" }],
};

describe("LinkCardView", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mountCard() {
    return mount(LinkCardView, {
      props: { link },
      global: { plugins: [pinia] },
    });
  }

  it("opens the menu after a long press and keeps the link from opening", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("touchstart");
    vi.advanceTimersByTime(500);
    await wrapper.trigger("touchend");

    expect(wrapper.emitted("contextAction")[0][0].link).toEqual(link);

    const click = new MouseEvent("click", { cancelable: true, bubbles: true });
    wrapper.element.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it("treats a short tap as a normal click", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("touchstart");
    vi.advanceTimersByTime(200);
    await wrapper.trigger("touchend");
    vi.advanceTimersByTime(500);

    expect(wrapper.emitted("contextAction")).toBeUndefined();
    const click = new MouseEvent("click", { cancelable: true, bubbles: true });
    wrapper.element.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it("cancels the long press when the finger moves (scrolling)", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("touchstart");
    await wrapper.trigger("touchmove");
    vi.advanceTimersByTime(600);
    expect(wrapper.emitted("contextAction")).toBeUndefined();
  });

  it("filters by a tag when its chip is clicked", async () => {
    const appStore = useAppStore();
    appStore.filterByTag = vi.fn();
    const wrapper = mountCard();
    await wrapper.find('[title="Show links tagged infra"]').trigger("click");
    expect(appStore.filterByTag).toHaveBeenCalledWith(9);
  });

  describe("compact rows on phones", () => {
    it("puts title and URL on one line below sm and stacks them from sm up", () => {
      const wrapper = mountCard();
      const textBlock = wrapper.find(".sm\\:block");
      expect(textBlock.classes()).toEqual(
        expect.arrayContaining(["flex", "items-baseline", "sm:block"]),
      );
      expect(textBlock.text()).toContain("Grafana");
      expect(textBlock.text()).toContain("https://grafana.example.com");
    });

    it("hides tags on phones", () => {
      const wrapper = mountCard();
      const tagButton = wrapper.find('[title="Show links tagged infra"]');
      expect(tagButton.element.parentElement.className).toContain("hidden sm:flex");
    });

    it("uses tighter padding on phones", () => {
      expect(mountCard().classes()).toEqual(
        expect.arrayContaining(["py-1", "sm:p-2"]),
      );
    });
  });
});
