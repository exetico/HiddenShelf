import { defineStore } from "pinia";

const SHOW_DELAY = 250; // passing over the note icon shouldn't flash a card
const HIDE_DELAY = 150; // time to move the pointer into the card

let showTimer = null;
let hideTimer = null;

/**
 * The hover card on desktop that shows a link's description. It opens from
 * the small note icon (not the whole row), so moving the mouse down the
 * list never covers the next link. Only links with a description have one.
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
