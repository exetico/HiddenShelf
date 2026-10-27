import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { useInfiniteScroll } from "@/composables/useInfiniteScroll";

let observerCallback;
class FakeObserver {
  constructor(callback) {
    observerCallback = callback;
  }
  observe() {}
  disconnect() {}
}

// Where the sentinel sits, in px from the top of a 800px window
let sentinelTop;

function mountWith(options) {
  return mount(
    defineComponent({
      setup() {
        const { sentinel } = useInfiniteScroll(options);
        return () =>
          h("div", {
            ref: (el) => {
              if (el) el.getBoundingClientRect = () => ({ top: sentinelTop() });
              sentinel.value = el;
            },
          });
      },
    }),
    { attachTo: document.body },
  );
}

// Lets loads, re-renders and animation frames run out
async function settle() {
  for (let i = 0; i < 8; i++) {
    await flushPromises();
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe("useInfiniteScroll", () => {
  let wrapper;
  beforeEach(() => {
    globalThis.IntersectionObserver = FakeObserver;
    window.innerHeight = 800;
  });
  afterEach(() => {
    wrapper?.unmount();
    delete globalThis.IntersectionObserver;
  });

  it("loads one page when the bottom comes into view, then stops once it's pushed away", async () => {
    // Each page of 20 items is 2000px tall, so one page fills the screen
    const items = ref(20);
    sentinelTop = () => items.value * 100;
    const loadMore = vi.fn(async () => {
      items.value += 20;
    });
    wrapper = mountWith({ hasMore: () => items.value < 200, loadMore, count: () => items.value });

    sentinelTop = () => 700; // scrolled to the bottom
    observerCallback([{ isIntersecting: true }]);
    await flushPromises();
    sentinelTop = () => 2700; // the new page pushed it down
    await settle();
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("keeps loading while short pages leave the bottom on screen", async () => {
    // 20px per item: 20 items don't fill an 800px window
    const items = ref(20);
    sentinelTop = () => items.value * 20;
    const loadMore = vi.fn(async () => {
      items.value += 20;
    });
    wrapper = mountWith({ hasMore: () => items.value < 200, loadMore, count: () => items.value });
    observerCallback([{ isIntersecting: true }]);
    await settle();
    // 20 -> 40 -> 60 (top 1200, past 800 + 200), then it stops
    expect(items.value).toBe(60);
    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it("does nothing while the bottom is out of view", async () => {
    sentinelTop = () => 5000;
    const loadMore = vi.fn();
    wrapper = mountWith({ hasMore: () => true, loadMore, count: () => 20 });
    observerCallback([{ isIntersecting: false }]);
    await settle();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it("stops when a page adds nothing, instead of looping", async () => {
    sentinelTop = () => 100;
    const loadMore = vi.fn(async () => {});
    wrapper = mountWith({ hasMore: () => true, loadMore, count: () => 20 });
    observerCallback([{ isIntersecting: true }]);
    await settle();
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("stops after a failed page", async () => {
    sentinelTop = () => 100;
    const loadMore = vi.fn().mockRejectedValue(new Error("offline"));
    wrapper = mountWith({ hasMore: () => true, loadMore, count: () => 20 });
    observerCallback([{ isIntersecting: true }]);
    await settle();
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("checks again when the first page lands under a sentinel that stayed on screen", async () => {
    // Nothing loaded yet when the observer fires; the first page is short
    const items = ref(0);
    sentinelTop = () => items.value * 20;
    const loadMore = vi.fn(async () => {
      items.value += 20;
    });
    wrapper = mountWith({
      hasMore: () => items.value > 0 && items.value < 60,
      loadMore,
      count: () => items.value,
    });
    observerCallback([{ isIntersecting: true }]);
    await settle();
    expect(loadMore).not.toHaveBeenCalled();

    items.value = 20; // the start-up load lands
    await settle();
    expect(items.value).toBe(60);
  });

  it("does not load ahead on mobile when the first page already fills the screen", async () => {
    // The observer fires before the first page; once it lands, the sentinel
    // is far below a phone screen, so no second page is fetched
    const items = ref(0);
    sentinelTop = () => items.value * 120;
    const loadMore = vi.fn(async () => {
      items.value += 20;
    });
    wrapper = mountWith({
      hasMore: () => items.value > 0 && items.value < 200,
      loadMore,
      count: () => items.value,
    });
    observerCallback([{ isIntersecting: true }]);
    items.value = 20;
    await settle();
    expect(loadMore).not.toHaveBeenCalled();
  });
});
