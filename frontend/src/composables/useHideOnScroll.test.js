import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { useHideOnScroll } from "@/composables/useHideOnScroll";

function scrollTo(y) {
  window.scrollY = y;
  window.dispatchEvent(new Event("scroll"));
  vi.runAllTimers(); // the rAF
}

describe("useHideOnScroll", () => {
  let wrapper, bar, typing;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout"] });
    window.scrollY = 0;
    typing = false;
    wrapper = mount(
      defineComponent({
        setup() {
          bar = useHideOnScroll({ keepVisible: () => typing });
          return () => h("div");
        },
      }),
    );
  });
  afterEach(() => {
    wrapper.unmount();
    vi.useRealTimers();
  });

  it("hides on the way down and comes back on the way up", () => {
    scrollTo(400);
    expect(bar.hidden.value).toBe(true);
    scrollTo(900);
    expect(bar.hidden.value).toBe(true);
    scrollTo(850);
    expect(bar.hidden.value).toBe(false);
    scrollTo(1200);
    expect(bar.hidden.value).toBe(true);
  });

  it("stays near the top of the page", () => {
    scrollTo(60);
    expect(bar.hidden.value).toBe(false);
    scrollTo(400);
    scrollTo(20);
    expect(bar.hidden.value).toBe(false);
  });

  it("ignores tiny jitters", () => {
    scrollTo(400);
    scrollTo(397);
    expect(bar.hidden.value).toBe(true);
    // Small steps add up from where it last decided
    scrollTo(394);
    scrollTo(390);
    expect(bar.hidden.value).toBe(false);
  });

  it("stays while you're typing in it, and shows on focus", () => {
    typing = true;
    scrollTo(500);
    expect(bar.hidden.value).toBe(false);
    typing = false;
    scrollTo(900);
    expect(bar.hidden.value).toBe(true);
    bar.show();
    expect(bar.hidden.value).toBe(false);
  });

  it("stops listening when the page goes", () => {
    wrapper.unmount();
    scrollTo(800);
    expect(bar.hidden.value).toBe(false);
    wrapper = mount(defineComponent({ render: () => h("div") }));
  });
});
