import { defineStore } from "pinia";

/**
 * The link details sheet: everything about one link, with previous/next
 * through the links currently on screen. Opened by a long press on phones,
 * the note icon or "Details" in the right-click menu.
 */
export const useLinkDetailsStore = defineStore("linkDetails", {
  state: () => ({
    links: [],
    index: -1,
  }),
  getters: {
    current: (state) => state.links[state.index] || null,
    hasPrev: (state) => state.index > 0,
    hasNext: (state) => state.index >= 0 && state.index < state.links.length - 1,
  },
  actions: {
    open(links, link) {
      this.links = links;
      this.index = links.findIndex((l) => l.id === link.id);
      if (this.index === -1) {
        this.links = [link];
        this.index = 0;
      }
    },
    next() {
      if (this.hasNext) this.index += 1;
    },
    prev() {
      if (this.hasPrev) this.index -= 1;
    },
    close() {
      this.index = -1;
      this.links = [];
    },
  },
});
