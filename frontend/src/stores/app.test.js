import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";

vi.mock("@/services/api/linksApi", () => ({
  linksApi: {
    list: vi.fn(),
    reorder: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
    favorites: vi.fn(),
  },
}));
vi.mock("@/services/api/categoriesApi", () => ({
  categoriesApi: { update: vi.fn(), reorder: vi.fn() },
}));
vi.mock("@/services/api/settingsApi", () => ({
  settingsApi: { get: vi.fn(), update: vi.fn() },
}));

import { linksApi } from "@/services/api/linksApi";
import { settingsApi } from "@/services/api/settingsApi";
import { categoriesApi } from "@/services/api/categoriesApi";

// Fake server holding `count` links, paged like GET /api/links
function serveLinks(count) {
  linksApi.list.mockImplementation(async ({ page, limit }) => {
    const start = (page - 1) * limit;
    const links = Array.from(
      { length: Math.max(0, Math.min(limit, count - start)) },
      (_, i) => ({ id: start + i + 1 }),
    );
    return {
      links,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    };
  });
}

describe("app store pagination", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    document.documentElement.style.setProperty = vi.fn();
  });

  it("has no more after the last page", async () => {
    serveLinks(52);
    const store = useAppStore();
    store.settings.links_per_page = 100;

    await store.loadLinks({ reset: true });

    expect(store.links).toHaveLength(52);
    expect(store.hasMore).toBe(false);
  });

  it("reloads from the first page when the page size changes", async () => {
    serveLinks(52);
    const store = useAppStore();
    await store.loadLinks({ reset: true });
    expect(store.links).toHaveLength(20);
    expect(store.hasMore).toBe(true);

    settingsApi.update.mockResolvedValue({
      links_per_page: 100,
      brand_color: "#687061",
    });
    await store.updateSettings({ links_per_page: 100 });

    expect(store.links).toHaveLength(52);
    expect(store.hasMore).toBe(false);
  });

  it("stops offering more when a page comes back short", async () => {
    serveLinks(52);
    const store = useAppStore();
    await store.loadLinks({ reset: true });
    // Two links deleted elsewhere since the first page loaded
    serveLinks(50);

    await store.loadMore();
    await store.loadMore();

    expect(store.links).toHaveLength(50);
    expect(store.hasMore).toBe(false);
  });
});

describe("app store category favorites and order", () => {
  let store;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useAppStore();
    store.categories = [
      { id: 1, name: "A", is_favorite: 0 },
      { id: 2, name: "B", is_favorite: 1 },
      { id: 3, name: "C", is_favorite: 0 },
    ];
  });

  it("lists favorite categories", () => {
    expect(store.favoriteCategories.map((c) => c.id)).toEqual([2]);
  });

  it("toggles a favorite and saves it", async () => {
    categoriesApi.update.mockResolvedValue({});
    await store.toggleFavorite(store.categories[0]);
    expect(store.categories[0].is_favorite).toBe(1);
    expect(categoriesApi.update).toHaveBeenCalledWith(1, { is_favorite: true });
  });

  it("rolls the favorite back when saving fails", async () => {
    categoriesApi.update.mockRejectedValue(new Error("offline"));
    await store.toggleFavorite(store.categories[1]);
    expect(store.categories[1].is_favorite).toBe(1);
  });

  it("moves a category down and saves the full order", async () => {
    categoriesApi.reorder.mockResolvedValue({});
    await store.moveCategory(store.categories[0], "down");
    expect(store.categories.map((c) => c.id)).toEqual([2, 1, 3]);
    expect(categoriesApi.reorder).toHaveBeenCalledWith([2, 1, 3]);
  });

  it("does nothing when moving past either end", async () => {
    await store.moveCategory(store.categories[0], "up");
    await store.moveCategory(store.categories[2], "down");
    expect(store.categories.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(categoriesApi.reorder).not.toHaveBeenCalled();
  });

  it("restores the old order when saving fails", async () => {
    categoriesApi.reorder.mockRejectedValue(new Error("offline"));
    await store.moveCategory(store.categories[2], "up");
    expect(store.categories.map((c) => c.id)).toEqual([1, 2, 3]);
  });
});

describe("app store link order", () => {
  let store;
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useAppStore();
    store.links = [
      { id: 1, category_id: 5 },
      { id: 2, category_id: 6 },
      { id: 3, category_id: 5 },
      { id: 4, category_id: 5 },
    ];
  });

  it("reorders one category in place and saves it", async () => {
    linksApi.reorder.mockResolvedValue({});
    await store.reorderLinks([4, 1, 3]);
    expect(store.links.map((l) => l.id)).toEqual([4, 2, 1, 3]);
    expect(store.links[0].display_order).toBe(1);
    expect(linksApi.reorder).toHaveBeenCalledWith([4, 1, 3]);
  });

  it("puts the old order back when saving fails", async () => {
    linksApi.reorder.mockRejectedValue(new Error("offline"));
    await store.reorderLinks([4, 1, 3]);
    expect(store.links.map((l) => l.id)).toEqual([1, 2, 3, 4]);
  });

  it("moves a link one step within its category", async () => {
    linksApi.reorder.mockResolvedValue({});
    await store.moveLink(store.links[2], "up");
    expect(linksApi.reorder).toHaveBeenCalledWith([3, 1, 4]);
    linksApi.reorder.mockClear();
    await store.moveLink({ id: 4, category_id: 5 }, "down");
    expect(linksApi.reorder).not.toHaveBeenCalled();
  });
});

describe("app store favorites and trash", () => {
  let store;
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    serveLinks(0);
    linksApi.favorites.mockResolvedValue([]);
    store = useAppStore();
    store.links = [
      { id: 1, title: "Beta", is_favorite: 0 },
      { id: 2, title: "alpha", is_favorite: 1 },
    ];
    store.favoriteLinks = [{ id: 2, title: "alpha", is_favorite: 1 }];
  });

  it("stars a link at once, sorted into the favorites", async () => {
    linksApi.update.mockResolvedValue({});
    await store.toggleLinkFavorite(store.links[0]);
    expect(store.links[0].is_favorite).toBe(1);
    expect(store.favoriteLinks.map((l) => l.title)).toEqual(["alpha", "Beta"]);
    expect(linksApi.update).toHaveBeenCalledWith(1, { is_favorite: true });
  });

  it("puts the star back when saving fails", async () => {
    linksApi.update.mockRejectedValue(new Error("offline"));
    await store.toggleLinkFavorite(store.links[1]);
    expect(store.links[1].is_favorite).toBe(1);
    expect(store.favoriteLinks.map((l) => l.id)).toEqual([2]);
  });

  it("moves a link to the trash with an Undo on the toast", async () => {
    linksApi.remove.mockResolvedValue({});
    linksApi.restore.mockResolvedValue({});
    await store.deleteLink(1);
    expect(linksApi.remove).toHaveBeenCalledWith(1);
    const toast = useToastStore();
    const item = toast.items.find((t) => t.message === "Moved to the trash");
    expect(item.action.label).toBe("Undo");
    await toast.runAction(item);
    expect(linksApi.restore).toHaveBeenCalledWith(1);
    expect(toast.items.find((t) => t.id === item.id)).toBeUndefined();
  });

  it("loads favorites alongside the links", async () => {
    linksApi.favorites.mockResolvedValue([{ id: 9, title: "Fav" }]);
    await store.refreshLinks();
    expect(store.favoriteLinks).toEqual([{ id: 9, title: "Fav" }]);
  });
});
