import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useContextMenuStore, visibleItems } from "@/stores/contextMenu";

describe("context menu store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("drops hidden items and stray dividers", () => {
    const a = { label: "A" };
    const b = { label: "B" };
    expect(
      visibleItems([
        { divider: true },
        a,
        { label: "hidden", hidden: true },
        { divider: true },
        { divider: true },
        b,
        { divider: true },
      ]),
    ).toEqual([a, { divider: true }, b]);
  });

  it("opens at the pointer and stops the browser menu", () => {
    const menu = useContextMenuStore();
    const event = { clientX: 40, clientY: 70, preventDefault: vi.fn() };
    menu.show(event, { title: "Link", items: [{ label: "Open" }] });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(menu).toMatchObject({ open: true, x: 40, y: 70, title: "Link" });
  });

  it("uses the finger position for a long press", () => {
    const menu = useContextMenuStore();
    menu.show(
      { touches: [{ clientX: 12, clientY: 34 }] },
      { items: [{ label: "Open" }] },
    );
    expect([menu.x, menu.y]).toEqual([12, 34]);
  });

  it("stays closed when every item is hidden", () => {
    const menu = useContextMenuStore();
    menu.show({}, { items: [{ label: "x", hidden: true }] });
    expect(menu.open).toBe(false);
  });

  it("closes and then runs the chosen action", async () => {
    const menu = useContextMenuStore();
    const action = vi.fn(() => expect(menu.open).toBe(false));
    menu.show({}, { items: [{ label: "Go", action }] });
    await menu.run(menu.items[0]);
    expect(action).toHaveBeenCalled();
  });

  it("ignores disabled items", async () => {
    const menu = useContextMenuStore();
    const action = vi.fn();
    menu.show({}, { items: [{ label: "No", disabled: true, action }] });
    await menu.run(menu.items[0]);
    expect(action).not.toHaveBeenCalled();
    expect(menu.open).toBe(true);
  });
});
