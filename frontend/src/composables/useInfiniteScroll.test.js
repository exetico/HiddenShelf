import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
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

function mountWith(options) {
  return mount(
    defineComponent({
      setup() {
        const { sentinel } = useInfiniteScroll(options);
        return () => h("div", { ref: sentinel });
      },
    }),
  );
}

describe("useInfiniteScroll", () => {
  beforeEach(() => {
    globalThis.IntersectionObserver = FakeObserver;
  });
  afterEach(() => {
    delete globalThis.IntersectionObserver;
  });

  it("loads pages while the bottom is in view and there is more", async () => {
    let items = 20;
    const loadMore = vi.fn(async () => {
      items += 20;
    });
    mountWith({ hasMore: () => items < 60, loadMore, count: () => items });
    observerCallback([{ isIntersecting: true }]);
    await flushPromises();
    // 20 -> 40 -> 60, then nothing more to load
    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it("does nothing while the bottom is out of view", async () => {
    const loadMore = vi.fn();
    mountWith({ hasMore: () => true, loadMore, count: () => 20 });
    observerCallback([{ isIntersecting: false }]);
    await flushPromises();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it("stops when a page adds nothing, instead of looping", async () => {
    const loadMore = vi.fn(async () => {});
    mountWith({ hasMore: () => true, loadMore, count: () => 20 });
    observerCallback([{ isIntersecting: true }]);
    await flushPromises();
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("stops after a failed page", async () => {
    const loadMore = vi.fn().mockRejectedValue(new Error("offline"));
    mountWith({ hasMore: () => true, loadMore, count: () => 20 });
    observerCallback([{ isIntersecting: true }]);
    await flushPromises();
    expect(loadMore).toHaveBeenCalledTimes(1);
  });
});
