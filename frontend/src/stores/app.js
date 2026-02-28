import { defineStore } from "pinia";
import { linksApi } from "@/services/api/linksApi";
import { categoriesApi } from "@/services/api/categoriesApi";
import { tagsApi } from "@/services/api/tagsApi";
import { sharesApi } from "@/services/api/sharesApi";
import { settingsApi } from "@/services/api/settingsApi";
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
    totalCategories: (state) => state.categories.length,
    totalTags: (state) => state.tags.length,
  },
  actions: {
    async bootstrap() {
      await Promise.all([
        this.loadSettings(),
        this.loadCategories(),
        this.loadTags(),
        this.loadSharedCategories(),
      ]);
      await this.loadLinks({ reset: true });
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
      this.settings = await settingsApi.update(payload);
      if (payload.brand_color) this.applyBrandColor(payload.brand_color);
    },
    applyBrandColor(hex) {
      document.documentElement.style.setProperty(
        "--brand-500",
        `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`,
      );
    },
    async loadLinks({ reset = false } = {}) {
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

      this.total = response.pagination.total;
      this.links = reset ? response.links : [...this.links, ...response.links];
    },
    async loadMore() {
      if (!this.hasMore) return;
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
  },
});
