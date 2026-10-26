import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useContextMenuStore } from "@/stores/contextMenu";
import ContextMenuPopover from "@/components/common/ContextMenuPopover.vue";

describe("ContextMenuPopover", () => {
  let pinia, menu, wrapper;
  const open = vi.fn();
  const remove = vi.fn();

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    menu = useContextMenuStore();
    open.mockClear();
    remove.mockClear();
    window.innerWidth = 1024;
    wrapper = mount(ContextMenuPopover, {
      global: { plugins: [pinia], stubs: { Teleport: true } },
      attachTo: document.body,
    });
    menu.show(
      { clientX: 100, clientY: 120 },
      {
        title: "My link",
        items: [
          { label: "Open in new tab", icon: "mdi-open-in-new", action: open },
          { divider: true },
          { label: "Delete", danger: true, action: remove },
        ],
      },
    );
    await flushPromises();
  });

  // Only one menu may listen for keys at a time, as in the app
  afterEach(() => wrapper.unmount());

  const items = () => wrapper.findAll('[role="menuitem"]');

  it("lists the items with a title and a hover title each", () => {
    expect(wrapper.find('[role="menu"]').attributes("aria-label")).toBe("My link");
    expect(items().map((b) => b.text())).toEqual(["Open in new tab", "Delete"]);
    expect(items().map((b) => b.attributes("title"))).toEqual([
      "Open in new tab",
      "Delete",
    ]);
    expect(items()[1].classes()).toContain("text-red-600");
    expect(wrapper.find("hr").exists()).toBe(true);
  });

  it("runs an item and closes", async () => {
    await items()[0].trigger("click");
    expect(open).toHaveBeenCalled();
    expect(menu.open).toBe(false);
  });

  it("closes on Escape and on a click outside", async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu.open).toBe(false);

    menu.show({ clientX: 1, clientY: 1 }, { items: [{ label: "A" }] });
    await flushPromises();
    await wrapper.find('[data-testid="context-menu-backdrop"]').trigger("click");
    expect(menu.open).toBe(false);
  });

  it("moves focus with the arrow keys", async () => {
    items()[0].element.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(items()[1].element);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(items()[0].element);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(document.activeElement).toBe(items()[1].element);
  });

  it("is a bottom sheet with a Cancel button on phones", async () => {
    menu.close();
    await flushPromises();
    window.innerWidth = 390;
    menu.show({ clientX: 1, clientY: 1 }, { items: [{ label: "A" }] });
    await flushPromises();
    expect(wrapper.find('[role="menu"]').classes()).toContain("bottom-0");
    expect(wrapper.findAll("button").at(-1).text()).toBe("Cancel");
  });
});
