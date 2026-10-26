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

  it("opens the details after a long press and keeps the link from opening", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("touchstart");
    vi.advanceTimersByTime(500);
    await wrapper.trigger("touchend");

    expect(wrapper.emitted("details")[0][0]).toEqual(link);

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

    expect(wrapper.emitted("details")).toBeUndefined();
    const click = new MouseEvent("click", { cancelable: true, bubbles: true });
    wrapper.element.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it("cancels the long press when the finger moves (scrolling)", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("touchstart");
    await wrapper.trigger("touchmove");
    vi.advanceTimersByTime(600);
    expect(wrapper.emitted("details")).toBeUndefined();
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

  describe("descriptions and dragging", () => {
    const withNote = { ...link, description: "Read *this*" };

    it("shows a note icon that opens the details for links with a description", async () => {
      const wrapper = mount(LinkCardView, {
        props: { link: withNote },
        global: { plugins: [pinia] },
      });
      const note = wrapper.find('[aria-label="Details for Grafana"]');
      await note.trigger("click");
      expect(wrapper.emitted("details")[0][0]).toEqual(withNote);
      expect(wrapper.attributes("title")).toBe(link.url);
      expect(mountCard().find('[aria-label="Details for Grafana"]').exists()).toBe(false);
    });

    it("has a drag handle only when it can be reordered", () => {
      expect(mountCard().find(".drag-handle").exists()).toBe(false);
      const wrapper = mount(LinkCardView, {
        props: { link, reorderable: true, groupKey: 5 },
        global: { plugins: [pinia] },
      });
      expect(wrapper.find(".drag-handle").attributes("title")).toBe("Drag to change the order");
    });

    it("emits a reorder when a link from the same category is dropped on it", async () => {
      const make = (l) =>
        mount(LinkCardView, {
          props: { link: l, reorderable: true, groupKey: 5 },
          global: { plugins: [pinia] },
        });
      const source = make({ ...link, id: 1 });
      const target = make({ ...link, id: 2 });
      const dataTransfer = { setData: vi.fn() };
      await source.find(".drag-handle").trigger("mousedown");
      await source.trigger("dragstart", { dataTransfer });
      expect(dataTransfer.setData).toHaveBeenCalled();
      target.element.getBoundingClientRect = () => ({ top: 0, height: 40 });
      await target.trigger("dragover", { clientY: 30, dataTransfer });
      await target.trigger("drop", { dataTransfer });
      expect(target.emitted("reorder")[0][0]).toEqual({
        draggedId: 1,
        targetId: 2,
        position: "after",
        groupKey: 5,
      });
    });

    it("a drag that didn't start at the handle is a normal URL drag", async () => {
      const source = mount(LinkCardView, {
        props: { link, reorderable: true, groupKey: 5 },
        global: { plugins: [pinia] },
      });
      const dataTransfer = { setData: vi.fn() };
      await source.trigger("dragstart", { dataTransfer });
      expect(dataTransfer.setData).not.toHaveBeenCalled();
    });
  });
});
