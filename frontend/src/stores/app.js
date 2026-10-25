import { defineStore } from "pinia";
import { linksApi } from "@/services/api/linksApi";
import { categoriesApi } from "@/services/api/categoriesApi";
import { tagsApi } from "@/services/api/tagsApi";
import { sharesApi } from "@/services/api/sharesApi";
import { settingsApi } from "@/services/api/settingsApi";
import { configApi } from "@/services/api/configApi";
import { linkVisitsApi } from "@/services/api/linkVisitsApi";
import { useToastStore } from "@/stores/toast";

export const useAppStore = defineStore("app", {
  state: () => ({
    loading: false,
    links: [],
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
    page: 1,
    total: 0,
    search: "",
    filterCategory: "",
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
      await this.loadLinks({ reset: true });
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
      this.applyBrandColor(this.settings.brand_color);
    },
    async updateSettings(payload) {
      const previousPerPage = this.settings.links_per_page;
      this.settings = await settingsApi.update(payload);
      if (payload.brand_color) this.applyBrandColor(payload.brand_color);
      // Pages are counted in the old size; start over so "Load more" lines up
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
    async loadLinks({ reset = false } = {}) {
      if (this._loadingLinks) return;
      this._loadingLinks = true;
      try {
        if (reset) {
          this.page = 1;
        }
        const response = await linksApi.list({
          page: this.page,
          limit: this.settings.links_per_page,
          categoryId:
            this.filterCategory === "uncategorized" ? "" : this.filterCategory,
          search: this.search,
        });

        this.links = reset
          ? response.links
          : [...this.links, ...response.links];
        // A short page means the server has nothing more, even if the count
        // changed in between (e.g. a link deleted elsewhere)
        const lastPage =
          response.links.length < response.pagination.limit ||
          response.pagination.page >= response.pagination.pages;
        this.total = lastPage ? this.links.length : response.pagination.total;
      } finally {
        this._loadingLinks = false;
      }
    },
    async loadMore() {
      if (!this.hasMore || this._loadingLinks) return;
      this.page += 1;
      await this.loadLinks();
    },
    async createLink(payload) {
      await linksApi.create(payload);
      await this.loadLinks({ reset: true });
      const toastStore = useToastStore();
      toastStore.success("Link created");
    },
    async updateLink(id, payload) {
      await linksApi.update(id, payload);
      await this.loadLinks({ reset: true });
      const toastStore = useToastStore();
      toastStore.success("Link updated");
    },
    async deleteLink(id) {
      await linksApi.remove(id);
      await this.loadLinks({ reset: true });
      const toastStore = useToastStore();
      toastStore.success("Link deleted");
    },
    async moveLink(link, direction) {
      const allLinks = this.links;
      const index = allLinks.findIndex((l) => l.id === link.id);
      if (index === -1) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= allLinks.length) return;
      // Swap display_order values
      const currentOrder = link.display_order ?? index;
      const targetLink = allLinks[targetIndex];
      const targetOrder = targetLink.display_order ?? targetIndex;
      await linksApi.update(link.id, { display_order: targetOrder });
      await linksApi.update(targetLink.id, { display_order: currentOrder });
      await this.loadLinks({ reset: true });
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
