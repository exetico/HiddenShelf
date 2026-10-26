import { defineStore } from "pinia";

/**
 * One app-wide right-click menu (long press on touch screens).
 *
 *   menu.show(event, {
 *     title: "Link name",
 *     items: [
 *       { label: "Open", icon: "mdi-open-in-new", action: () => ... },
 *       { divider: true },
 *       { label: "Delete", icon: "mdi-delete-outline", danger: true, action },
 *     ],
 *   });
 *
 * Items with `hidden: true` are left out, and dividers at the edges or
 * next to each other are dropped. ContextMenuPopover.vue (in App.vue)
 * shows it at the pointer, or as a bottom sheet on small screens.
 */
export function visibleItems(items) {
  const result = [];
  for (const item of items) {
    if (item.hidden) continue;
    if (item.divider && (!result.length || result.at(-1).divider)) continue;
    result.push(item);
  }
  if (result.at(-1)?.divider) result.pop();
  return result;
}

function pointFrom(event) {
  const touch = event?.touches?.[0] || event?.changedTouches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  if (event && typeof event.clientX === "number" && (event.clientX || event.clientY)) {
    return { x: event.clientX, y: event.clientY };
  }
  // Keyboard (context-menu key / Shift+F10): open by the element
  const rect = event?.currentTarget?.getBoundingClientRect?.();
  return rect ? { x: rect.left + 16, y: rect.bottom } : { x: 0, y: 0 };
}

export const useContextMenuStore = defineStore("contextMenu", {
  state: () => ({
    open: false,
    x: 0,
    y: 0,
    title: "",
    items: [],
  }),
  actions: {
    show(event, { title = "", items = [] }) {
      event?.preventDefault?.();
      const point = pointFrom(event);
      this.x = point.x;
      this.y = point.y;
      this.title = title;
      this.items = visibleItems(items);
      this.open = this.items.length > 0;
    },
    close() {
      this.open = false;
    },
    async run(item) {
      if (item.disabled || item.divider) return;
      this.close();
      await item.action?.();
    },
  },
});
