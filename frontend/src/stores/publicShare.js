import { defineStore } from "pinia";

/**
 * The "Public link" dialog: the short link to copy, a QR code to scan or
 * save, and code to embed it on another website. Opened from the globe on a card, the link menu and the details
 * sheet; mounted once in App.vue.
 */
export const usePublicShareStore = defineStore("publicShare", {
  state: () => ({ link: null }),
  actions: {
    open(link) {
      if (link?.is_public && link.hash) this.link = link;
    },
    close() {
      this.link = null;
    },
  },
});
