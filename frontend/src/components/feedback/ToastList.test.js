import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useToastStore } from "@/stores/toast";
import ToastList from "@/components/feedback/ToastList.vue";

describe("ToastList", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.useFakeTimers();
  });

  function mountToastList() {
    return mount(ToastList, {
      global: { plugins: [pinia] },
    });
  }

  it("renders toast messages", () => {
    const store = useToastStore();
    store.success("Hello");

    const wrapper = mountToastList();
    expect(wrapper.text()).toContain("Hello");
  });

  it("applies correct class for success type", () => {
    const store = useToastStore();
    store.success("OK");

    const wrapper = mountToastList();
    const toast = wrapper.find(".bg-green-600");
    expect(toast.exists()).toBe(true);
  });

  it("applies correct class for error type", () => {
    const store = useToastStore();
    store.error("Bad");

    const wrapper = mountToastList();
    const toast = wrapper.find(".bg-red-600");
    expect(toast.exists()).toBe(true);
  });

  it("applies correct class for info type", () => {
    const store = useToastStore();
    store.info("Note");

    const wrapper = mountToastList();
    const toast = wrapper.find(".bg-blue-600");
    expect(toast.exists()).toBe(true);
  });

  it("renders progress bar with correct animation duration", () => {
    const store = useToastStore();
    store.success("Progress");

    const wrapper = mountToastList();
    const progressBar = wrapper.find(".toast-progress");
    expect(progressBar.exists()).toBe(true);
    expect(progressBar.attributes("style")).toContain("3500ms");
  });

  it("removes toast on click", async () => {
    const store = useToastStore();
    store.success("Click me");

    const wrapper = mountToastList();
    await wrapper.find(".cursor-pointer").trigger("click");
    expect(store.items).toHaveLength(0);
  });

  it("renders multiple toasts", () => {
    const store = useToastStore();
    store.success("First");
    store.error("Second");

    const wrapper = mountToastList();
    expect(wrapper.text()).toContain("First");
    expect(wrapper.text()).toContain("Second");
  });

  it("stacks above modals", () => {
    const wrapper = mountToastList();
    expect(wrapper.find("div.fixed").classes()).toContain("z-[1000]");
  });
});
