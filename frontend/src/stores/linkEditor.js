import { defineStore } from "pinia";
import { useAppStore } from "@/stores/app";

/**
 * The one link editor, opened on top of whatever page you're on: "Add
 * link" in the top bar, Edit from a card, the link menu or the details
 * sheet. Mounted once in App.vue (LinkEditorHost).
 */
export const useLinkEditorStore = defineStore("linkEditor", {
  state: () => ({ link: null }),
  actions: {
    open(link) {
      this.link = link;
    },
    // A new link starts in the category and with the tag the list is
    // filtered by, so it shows up in the list you're looking at
    create(prefill = null) {
      const appStore = useAppStore();
      const category = Number(appStore.filterCategory) || "";
      const tag = appStore.tags.find((t) => String(t.id) === appStore.filterTag);
      this.link = {
        category_id: appStore.categories.some((c) => c.id === category) ? category : "",
        tags: tag ? [{ name: tag.name }] : [],
        ...prefill,
      };
    },
    close() {
      this.link = null;
    },
  },
});
