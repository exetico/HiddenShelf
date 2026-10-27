import { defineStore } from "pinia";
import { linksApi } from "@/services/api/linksApi";
import { categoriesApi } from "@/services/api/categoriesApi";
import { tagsApi } from "@/services/api/tagsApi";
import { sharesApi } from "@/services/api/sharesApi";
import { settingsApi } from "@/services/api/settingsApi";
import { configApi } from "@/services/api/configApi";
import { linkVisitsApi } from "@/services/api/linkVisitsApi";
import { useToastStore } from "@/stores/toast";
import { useDialogStore } from "@/stores/dialog";

// The links request running now, so later callers can wait for it, and
// a counter so an answer that a newer reset has replaced is dropped
let linksInFlight = null;
let linksRequestId = 0;

export const useAppStore = defineStore("app", {
  state: () => ({
    loading: false,
    links: [],
    // Every favorite link, whatever page of `links` it's on
    favoriteLinks: [],
    categories: [],
    tags: [],
    sharedCategories: [],
    settings: {
      links_per_page: 20,
      brand_color: "#687061",
    },
    appConfig: {
      app_version: "",
      site_name: "Hidden Shelf",
    },
    visitStats: {
      total_visits: 0,
      days: 30,
      summary: [],
    },
    total: 0,
    // True once the user's settings (page size) are in; until then the
    // start-up load is on its way and views shouldn't fetch on their own
    settingsLoaded: false,
    // How the list is paged: "category" on View (whole categories, in View
    // order), "" on Edit (newest first)
    linkGrouping: "",
    search: "",
    filterCategory: "",
    filterTag: "",
  }),
  getters: {
    hasMore: (state) => state.links.length < state.total,
    linksByCategory: (state) => {
      const grouped = new Map();

      for (const link of state.links) {
        const categoryKey = link.category_id || "uncategorized";
        if (!grouped.has(categoryKey)) grouped.set(categoryKey, []);
        grouped.get(categoryKey).push(link);
      }

      return grouped;
    },
    favoriteCategories: (state) =>
      state.categories.filter((c) => c.is_favorite),
    totalCategories: (state) =>
      state.categories.length + state.sharedCategories.length,
    totalTags: (state) => state.tags.length,
  },
  actions: {
    async bootstrap() {
      await Promise.all([
        this.loadSettings(),
        this.loadCategories(),
        this.loadTags(),
        this.loadSharedCategories(),
        this.loadAppConfig(),
      ]);
      await Promise.all([this.loadLinks({ reset: true }), this.loadFavorites()]);
      await this.checkPendingShare();
    },
    async withLoading(fn) {
      this.loading = true;
      try {
        await fn();
      } catch (error) {
        const toastStore = useToastStore();
        toastStore.error(error.message);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async loadSettings() {
      this.settings = await settingsApi.get();
      this.settingsLoaded = true;
      this.applyBrandColor(this.settings.brand_color);
    },
    async updateSettings(payload) {
      const previousPerPage = this.settings.links_per_page;
      this.settings = await settingsApi.update(payload);
      if (payload.brand_color) this.applyBrandColor(payload.brand_color);
      // Start over in the new size
      if (this.settings.links_per_page !== previousPerPage) {
        await this.loadLinks({ reset: true });
      }
    },
    applyBrandColor(hex) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
      const set = (name, rr, gg, bb) =>
        document.documentElement.style.setProperty(
          name,
          `${clamp(rr)} ${clamp(gg)} ${clamp(bb)}`,
        );

      set("--brand-50", r + 80, g + 80, b + 80);
      set("--brand-100", r + 60, g + 60, b + 60);
      set("--brand-200", r + 40, g + 40, b + 40);
      set("--brand-300", r + 25, g + 25, b + 25);
      set("--brand-400", r + 10, g + 10, b + 10);
      set("--brand-500", r, g, b);
      set("--brand-600", r - 15, g - 15, b - 15);
      set("--brand-700", r - 30, g - 30, b - 30);
      set("--brand-800", r - 50, g - 50, b - 50);
      set("--brand-900", r - 65, g - 65, b - 65);
      set("--brand-950", r - 85, g - 85, b - 85);
    },
    // Loads the first page (reset) or the next one. Pages are fetched by
    // offset (how many are loaded), so a page-size change can't skip links.
    // A reset always starts a fresh request and wins over one still
    // running (e.g. the views' first load racing the start-up load); a
    // "next page" while one is running just waits for that one.
    async loadLinks({ reset = false } = {}) {
      if (!reset && linksInFlight) return linksInFlight;
      const id = ++linksRequestId;
      this._loadingLinks = true;
      const run = this._fetchLinks(reset, id).finally(() => {
        if (id !== linksRequestId) return;
        this._loadingLinks = false;
        linksInFlight = null;
      });
      linksInFlight = run;
      return run;
    },
    async _fetchLinks(reset, id) {
      const offset = reset ? 0 : this.links.length;
      const response = await linksApi.list({
        offset,
        limit: this.settings.links_per_page,
        categoryId:
          this.filterCategory === "uncategorized" ? "" : this.filterCategory,
        search: this.search.trim(),
        tagId: this.filterTag,
        group: this.linkGrouping,
      });
      // A newer reset started meanwhile; its result is the one to show
      if (id !== linksRequestId) return;

      this.links = reset
        ? response.links
        : [...this.links, ...response.links];
      // A short page means the server has nothing more, even if the count
      // changed in between (e.g. a link deleted elsewhere)
      const lastPage =
        response.links.length < response.pagination.limit ||
        offset + response.links.length >= response.pagination.total;
      this.total = lastPage ? this.links.length : response.pagination.total;
    },
    // Each page sets the order it needs. Before start-up has loaded the
    // settings, start-up's own load picks this up
    async setLinkGrouping(mode) {
      if (this.linkGrouping === mode) return;
      this.linkGrouping = mode;
      if (this.settingsLoaded) await this.loadLinks({ reset: true });
    },
    // Infinite scroll and "Load more". While a load is running this only
    // waits for it: the caller looks again afterwards, so nothing is
    // fetched ahead of need
    async loadMore() {
      if (linksInFlight) {
        await linksInFlight.catch(() => {});
        return;
      }
      if (!this.hasMore) return;
      await this.loadLinks();
    },
    async loadFavorites() {
      try {
        this.favoriteLinks = await linksApi.favorites();
      } catch {
        // Favorites are a shortcut; the shelf works without them
      }
    },
    async refreshLinks() {
      await Promise.all([this.loadLinks({ reset: true }), this.loadFavorites()]);
    },
    async createLink(payload) {
      await linksApi.create(payload);
      await this.refreshLinks();
      const toastStore = useToastStore();
      toastStore.success("Link created");
    },
    async updateLink(id, payload) {
      await linksApi.update(id, payload);
      await this.refreshLinks();
      const toastStore = useToastStore();
      toastStore.success("Link updated");
    },
    /** Star or unstar a link; shown at once, put back if saving fails */
    async toggleLinkFavorite(link) {
      const value = link.is_favorite ? 0 : 1;
      const setEverywhere = (v) => {
        for (const l of this.links) if (l.id === link.id) l.is_favorite = v;
        link.is_favorite = v;
      };
      const previousFavorites = this.favoriteLinks;
      setEverywhere(value);
      this.favoriteLinks = value
        ? [...this.favoriteLinks, { ...link, is_favorite: 1 }].sort((a, b) =>
            a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
          )
        : this.favoriteLinks.filter((l) => l.id !== link.id);
      try {
        await linksApi.update(link.id, { is_favorite: !!value });
      } catch (error) {
        setEverywhere(value ? 0 : 1);
        this.favoriteLinks = previousFavorites;
        useToastStore().error(error.message || "Couldn't save the favorite");
      }
    },
    /** Moves the link to the trash; the toast can undo it */
    async deleteLink(id) {
      await linksApi.remove(id);
      await this.refreshLinks();
      useToastStore().success("Moved to the trash", {
        action: { label: "Undo", run: () => this.restoreLink(id) },
        duration: 6000,
      });
    },
    /** Asks first, then moves the link to the trash. Resolves true if it did. */
    async trashLink(link) {
      const ok = await useDialogStore().confirm({
        title: `Move "${link.title}" to the trash?`,
        message: "You can restore it from Trash for 30 days.",
        confirmText: "Move to trash",
        danger: true,
        icon: "mdi-delete-outline",
      });
      if (!ok) return false;
      await this.deleteLink(link.id);
      return true;
    },
    async restoreLink(id) {
      await linksApi.restore(id);
      await this.refreshLinks();
      useToastStore().success("Link restored");
    },
    /** Save a dragged order; `ids` is one category's links, in order */
    async reorderLinks(ids) {
      const previous = this.links;
      // Optimistic: put these links in their new order, in the slots they
      // already take up in the list, so nothing else moves
      const slots = this.links
        .map((link, i) => (ids.includes(link.id) ? i : -1))
        .filter((i) => i !== -1);
      const byId = new Map(this.links.map((link) => [link.id, link]));
      const next = [...this.links];
      slots.forEach((slot, n) => {
        next[slot] = { ...byId.get(ids[n]), display_order: n + 1 };
      });
      this.links = next;
      try {
        await linksApi.reorder(ids);
      } catch (error) {
        this.links = previous;
        useToastStore().error(error.message || "Couldn't save the new order");
      }
    },
    /** One step up or down within the link's category */
    async moveLink(link, direction) {
      const key = link.category_id || "uncategorized";
      const ids = (this.linksByCategory.get(key) || []).map((l) => l.id);
      const from = ids.indexOf(link.id);
      const to = direction === "up" ? from - 1 : from + 1;
      if (from === -1 || to < 0 || to >= ids.length) return;
      [ids[from], ids[to]] = [ids[to], ids[from]];
      await this.reorderLinks(ids);
    },
    async loadCategories() {
      this.categories = await categoriesApi.list();
    },
    async createCategory(payload) {
      await categoriesApi.create(payload);
      await this.loadCategories();
      const toastStore = useToastStore();
      toastStore.success("Category created");
    },
    async deleteCategory(id) {
      await categoriesApi.remove(id);
      await Promise.all([
        this.loadCategories(),
        this.loadLinks({ reset: true }),
      ]);
      const toastStore = useToastStore();
      toastStore.success("Category deleted");
    },
    async updateCategory(id, payload) {
      await categoriesApi.update(id, payload);
      await this.loadCategories();
      const toastStore = useToastStore();
      toastStore.success("Category updated");
    },
    async toggleFavorite(category) {
      const isFavorite = !category.is_favorite;
      category.is_favorite = isFavorite ? 1 : 0; // optimistic
      try {
        await categoriesApi.update(category.id, { is_favorite: isFavorite });
      } catch (error) {
        category.is_favorite = isFavorite ? 0 : 1;
        useToastStore().error(error.message);
      }
    },
    /** Ask first, then toggle. Used where a stray tap is easy (View). */
    async confirmToggleFavorite(category) {
      const adding = !category.is_favorite;
      const ok = await useDialogStore().confirm({
        title: adding ? "Add to favorites?" : "Remove from favorites?",
        message: adding
          ? `"${category.name}" will be pinned above your links.`
          : `"${category.name}" will no longer be pinned above your links.`,
        confirmText: adding ? "Add" : "Remove",
        icon: adding ? "mdi-star" : "mdi-star-off-outline",
      });
      if (ok) await this.toggleFavorite(category);
      return ok;
    },
    async moveCategory(category, direction) {
      const list = [...this.categories];
      const from = list.findIndex((c) => c.id === category.id);
      const to = direction === "up" ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= list.length) return;
      [list[from], list[to]] = [list[to], list[from]];
      const previous = this.categories;
      this.categories = list; // optimistic
      try {
        await categoriesApi.reorder(list.map((c) => c.id));
      } catch (error) {
        this.categories = previous;
        useToastStore().error(error.message);
      }
    },
    async filterByTag(tagId) {
      this.filterTag = tagId ? String(tagId) : "";
      await this.loadLinks({ reset: true });
    },
    async loadTags() {
      this.tags = await tagsApi.list();
    },
    async createTag(name) {
      await tagsApi.create({ name });
      await this.loadTags();
      const toastStore = useToastStore();
      toastStore.success("Tag created");
    },
    async deleteTag(id) {
      await tagsApi.remove(id);
      await this.loadTags();
      const toastStore = useToastStore();
      toastStore.success("Tag deleted");
    },
    async loadSharedCategories() {
      this.sharedCategories = await sharesApi.listSharedCategories();
    },
    async acceptShare(shareCode) {
      await sharesApi.acceptShare(shareCode);
      await Promise.all([
        this.loadSharedCategories(),
        this.loadLinks({ reset: true }),
      ]);
      const toastStore = useToastStore();
      toastStore.success("Joined shared category");
    },
    async leaveSharedCategory(categoryId) {
      await sharesApi.leaveSharedCategory(categoryId);
      await Promise.all([
        this.loadSharedCategories(),
        this.loadLinks({ reset: true }),
      ]);
      const toastStore = useToastStore();
      toastStore.success("Left shared category");
    },
    async loadAppConfig() {
      try {
        this.appConfig = await configApi.get();
      } catch {
        // Non-critical — keep defaults
      }
    },
    async loadVisitStats(days = 30) {
      try {
        const data = await linkVisitsApi.getSummary({ days });
        this.visitStats = {
          total_visits: data.total_visits || 0,
          days: data.days || days,
          summary: data.summary || [],
        };
      } catch {
        // Non-critical — keep defaults
      }
    },
    async checkPendingShare() {
      const pendingCode = sessionStorage.getItem("hiddenshelf_pending_share");
      if (!pendingCode) return;
      sessionStorage.removeItem("hiddenshelf_pending_share");
      try {
        await this.acceptShare(pendingCode);
      } catch {
        const toastStore = useToastStore();
        toastStore.error("Failed to join shared category");
      }
    },
  },
});
