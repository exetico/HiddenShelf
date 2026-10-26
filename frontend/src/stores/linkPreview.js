import { defineStore } from "pinia";

const SHOW_DELAY = 450; // hovering past a link shouldn't flash a card
const HIDE_DELAY = 150; // time to move the pointer into the card

let showTimer = null;
let hideTimer = null;

/**
 * The hover card on desktop that shows a link's description. Only links
 * with a description get one, so it never adds noise to the rest.
 */
export const useLinkPreviewStore = defineStore("linkPreview", {
  state: () => ({
    link: null,
    rect: null,
  }),
  actions: {
    hoverStart(link, element) {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      if (!link.description) {
        this.link = null;
        return;
      }
      showTimer = setTimeout(() => {
        this.link = link;
        this.rect = element.getBoundingClientRect();
      }, this.link ? 0 : SHOW_DELAY);
    },
    hoverEnd() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => this.hide(), HIDE_DELAY);
    },
    // The pointer moved onto the card itself
    keep() {
      clearTimeout(hideTimer);
    },
    hide() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      this.link = null;
      this.rect = null;
    },
  },
});
