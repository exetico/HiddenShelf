import { defineStore } from "pinia";

/**
 * The link editor opened on top of the page you're on, so editing from
 * View (the link menu or the details sheet) doesn't leave View. The Edit
 * page keeps its own editor, which also adds links. Mounted once in App.vue.
 */
export const useLinkEditorStore = defineStore("linkEditor", {
  state: () => ({ link: null }),
  actions: {
    open(link) {
      this.link = link;
    },
    close() {
      this.link = null;
    },
  },
});
