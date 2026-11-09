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

  it("shows the status icon for success type", () => {
    const store = useToastStore();
    store.success("OK");

    const wrapper = mountToastList();
    const toast = wrapper.find('[data-type="success"]');
    expect(toast.exists()).toBe(true);
    expect(toast.find("i.mdi-check-circle").exists()).toBe(true);
  });

  it("shows the status icon for error type", () => {
    const store = useToastStore();
    store.error("Bad");

    const wrapper = mountToastList();
    const toast = wrapper.find('[data-type="error"]');
    expect(toast.exists()).toBe(true);
    expect(toast.find("i.mdi-alert-circle").exists()).toBe(true);
  });

  it("shows the status icon for info type", () => {
    const store = useToastStore();
    store.info("Note");

    const wrapper = mountToastList();
    const toast = wrapper.find('[data-type="info"]');
    expect(toast.exists()).toBe(true);
    expect(toast.find("i.mdi-information").exists()).toBe(true);
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
    await wrapper.find(".toast").trigger("click");
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

  it("shows an action button that runs and closes the toast", async () => {
    const store = useToastStore();
    const run = vi.fn();
    store.success("Moved to the trash", { action: { label: "Undo", run }, duration: 6000 });
    const wrapper = mountToastList();
    const button = wrapper.find('button[title="Undo"]');
    await button.trigger("click");
    expect(run).toHaveBeenCalled();
    expect(store.items).toHaveLength(0);
  });

  it("keeps a toast with an action up for its own duration", () => {
    const store = useToastStore();
    store.success("Moved", { action: { label: "Undo", run: vi.fn() }, duration: 6000 });
    vi.advanceTimersByTime(4000);
    expect(store.items).toHaveLength(1);
    vi.advanceTimersByTime(2000);
    expect(store.items).toHaveLength(0);
  });

  it("uses the theme surface instead of a solid status color", () => {
    const store = useToastStore();
    store.error("Bad");
    const toast = mountToastList().find(".toast");
    expect(toast.classes()).toContain("bg-white/95");
    expect(toast.classes()).toContain("dark:bg-brand-900/95");
    expect(toast.classes().some((c) => /^bg-(red|green|blue)-/.test(c))).toBe(false);
  });

  it("announces errors as alerts and the rest as status", () => {
    const store = useToastStore();
    store.error("Bad");
    store.success("Good");
    const wrapper = mountToastList();
    expect(wrapper.find('[data-type="error"]').attributes("role")).toBe("alert");
    expect(wrapper.find('[data-type="success"]').attributes("role")).toBe("status");
  });

  it("closes with the dismiss button", async () => {
    const store = useToastStore();
    store.info("Note");
    const wrapper = mountToastList();
    await wrapper.find('button[title="Dismiss"]').trigger("click");
    expect(store.items).toHaveLength(0);
  });

  it("sits at the bottom of the screen", () => {
    const classes = mountToastList().find("div.fixed").classes();
    expect(classes.some((c) => c.startsWith("bottom-"))).toBe(true);
    expect(classes.some((c) => c.startsWith("top-"))).toBe(false);
  });
});
