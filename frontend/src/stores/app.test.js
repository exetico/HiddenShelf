import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore, STALE_AFTER_MS } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { useDialogStore } from "@/stores/dialog";
import { flushPromises } from "@vue/test-utils";

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
vi.mock("@/services/api/tagsApi", () => ({
  tagsApi: { list: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/services/api/settingsApi", () => ({
  settingsApi: { get: vi.fn(), update: vi.fn() },
}));

import { linksApi } from "@/services/api/linksApi";

// The sort is remembered in localStorage; start every test in your own order
beforeEach(() => localStorage.clear());
import { settingsApi } from "@/services/api/settingsApi";
import { categoriesApi } from "@/services/api/categoriesApi";
import { tagsApi } from "@/services/api/tagsApi";

// Fake server holding `count` links; GET /api/links returns them all
function serveLinks(count) {
  linksApi.list.mockImplementation(async () => ({
    links: Array.from({ length: count }, (_, i) => ({ id: i + 1, title: `Link ${i + 1}` })),
  }));
}

describe("app store shelf loading", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    document.documentElement.style.setProperty = vi.fn();
  });

  it("loads the whole shelf in one request", async () => {
    serveLinks(523);
    const store = useAppStore();
    expect(store.linksLoaded).toBe(false);

    await store.loadLinks();

    expect(linksApi.list).toHaveBeenCalledTimes(1);
    expect(linksApi.list).toHaveBeenCalledWith();
    expect(store.allLinks).toHaveLength(523);
    expect(store.links).toHaveLength(523);
    expect(store.total).toBe(523);
    expect(store.linksLoaded).toBe(true);
  });

  it("searches, filters and sorts without asking the server again", async () => {
    serveLinks(30);
    const store = useAppStore();
    await store.loadLinks();

    store.search = "Link 2";
    expect(store.links.map((l) => l.id)).toEqual([2, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
    store.setSort("title_desc");
    expect(store.links[0].id).toBe(29);
    // The shelf's count doesn't follow the search
    expect(store.total).toBe(30);
    expect(linksApi.list).toHaveBeenCalledTimes(1);
  });

  it("keeps the newer answer when two loads overlap", async () => {
    const store = useAppStore();
    let answerOld;
    linksApi.list
      .mockImplementationOnce(() => new Promise((resolve) => (answerOld = resolve)))
      .mockResolvedValueOnce({ links: [{ id: 1 }, { id: 2 }] });
    const old = store.loadLinks();
    await store.loadLinks();
    answerOld({ links: [{ id: 1 }] });
    await old;
    expect(store.allLinks.map((l) => l.id)).toEqual([1, 2]);
  });

  it("checks for changes when you come back to the tab after a while", async () => {
    vi.useFakeTimers();
    try {
      serveLinks(1);
      const store = useAppStore();
      store.loadCategories = vi.fn().mockResolvedValue();
      store.loadSharedCategories = vi.fn().mockResolvedValue();
      store.loadTags = vi.fn().mockResolvedValue();
      let state = "visible";
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      const flip = (to) => {
        state = to;
        document.dispatchEvent(new Event("visibilitychange"));
      };
      store.startFreshnessCheck();

      // A quick look at another tab: nothing
      flip("hidden");
      vi.advanceTimersByTime(5_000);
      flip("visible");
      expect(linksApi.list).not.toHaveBeenCalled();

      flip("hidden");
      vi.advanceTimersByTime(STALE_AFTER_MS);
      flip("visible");
      expect(linksApi.list).toHaveBeenCalledTimes(1);
      expect(store.loadCategories).toHaveBeenCalled();
      expect(store.loadSharedCategories).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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
    store.allLinks = [
      { id: 1, category_id: 5, created_at: "2026-01-04 00:00:00" },
      { id: 2, category_id: 6, created_at: "2026-01-03 00:00:00" },
      { id: 3, category_id: 5, created_at: "2026-01-02 00:00:00" },
      { id: 4, category_id: 5, created_at: "2026-01-01 00:00:00" },
    ];
  });
  const inCategory = (id) => store.linksByCategory.get(id).map((l) => l.id);

  it("reorders one category at once and saves it", async () => {
    linksApi.reorder.mockResolvedValue({});
    await store.reorderLinks([4, 1, 3]);
    expect(inCategory(5)).toEqual([4, 1, 3]);
    expect(inCategory(6)).toEqual([2]);
    expect(store.allLinks.find((l) => l.id === 4).display_order).toBe(1);
    expect(linksApi.reorder).toHaveBeenCalledWith([4, 1, 3]);
  });

  it("puts the old order back when saving fails", async () => {
    linksApi.reorder.mockRejectedValue(new Error("offline"));
    await store.reorderLinks([4, 1, 3]);
    expect(inCategory(5)).toEqual([1, 3, 4]);
  });

  it("moves a link one step within its category", async () => {
    linksApi.reorder.mockResolvedValue({});
    await store.moveLink(store.allLinks[2], "up");
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
    store = useAppStore();
    store.allLinks = [
      { id: 1, title: "Beta", is_favorite: 0 },
      { id: 2, title: "alpha", is_favorite: 1 },
    ];
  });

  it("stars a link at once, sorted into the favorites", async () => {
    linksApi.update.mockResolvedValue({});
    await store.toggleLinkFavorite(store.allLinks[0]);
    expect(store.allLinks[0].is_favorite).toBe(1);
    expect(store.favoriteLinks.map((l) => l.title)).toEqual(["alpha", "Beta"]);
    expect(linksApi.update).toHaveBeenCalledWith(1, { is_favorite: true });
  });

  it("puts the star back when saving fails", async () => {
    linksApi.update.mockRejectedValue(new Error("offline"));
    await store.toggleLinkFavorite(store.allLinks[1]);
    expect(store.allLinks[1].is_favorite).toBe(1);
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

  it("takes favorites from the shelf: your own, outside hidden categories", () => {
    store.categories = [{ id: 5, is_hidden: 1 }];
    store.allLinks.push(
      { id: 3, title: "Shared", is_favorite: 1, is_from_shared_category: 1 },
      { id: 4, title: "Secret", is_favorite: 1, category_id: 5 },
    );
    expect(store.favoriteLinks.map((l) => l.id)).toEqual([2]);
  });

  it("asks before moving a link to the trash", async () => {
    linksApi.remove.mockResolvedValue({});
    const dialog = useDialogStore();

    const no = store.trashLink({ id: 1, title: "Beta" });
    expect(dialog.current).toMatchObject({
      title: 'Move "Beta" to the trash?',
      confirmText: "Move to trash",
      danger: true,
    });
    dialog.close(false);
    expect(await no).toBe(false);
    expect(linksApi.remove).not.toHaveBeenCalled();

    const yes = store.trashLink({ id: 1, title: "Beta" });
    dialog.close(true);
    expect(await yes).toBe(true);
    await flushPromises();
    expect(linksApi.remove).toHaveBeenCalledWith(1);
  });
});

describe("app store tags", () => {
  let store;
  beforeEach(() => {
    setActivePinia(createPinia());
    store = useAppStore();
    store.allLinks = [
      { id: 1, title: "One", tags: [{ id: 7, name: "infra" }, { id: 8, name: "home" }] },
      { id: 2, title: "Two", tags: [] },
      { id: 3, title: "Fav", is_favorite: 1, tags: [{ id: 7, name: "infra" }] },
    ];
    tagsApi.list.mockResolvedValue([{ id: 7, name: "servers", usage_count: 2 }]);
  });

  it("renames a tag on the cards already shown", async () => {
    tagsApi.update.mockResolvedValue({ id: 7, name: "servers" });
    await store.renameTag(7, "servers");
    expect(tagsApi.update).toHaveBeenCalledWith(7, { name: "servers" });
    expect(store.allLinks[0].tags.map((t) => t.name)).toEqual(["servers", "home"]);
    expect(store.favoriteLinks[0].tags[0].name).toBe("servers");
    expect(store.tags).toEqual([{ id: 7, name: "servers", usage_count: 2 }]);
  });

  it("takes a deleted tag off the cards, and clears it as the filter", async () => {
    tagsApi.remove.mockResolvedValue({});
    store.filterTag = "7";
    await store.deleteTag(7);
    expect(store.allLinks[0].tags).toEqual([{ id: 8, name: "home" }]);
    expect(store.favoriteLinks[0].tags).toEqual([]);
    expect(store.filterTag).toBe("");
  });
});

describe("app store hidden categories", () => {
  let store;
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useAppStore();
    categoriesApi.update.mockResolvedValue({});
    store.categories = [
      { id: 5, name: "Friend", is_hidden: 1 },
      { id: 6, name: "Mine", is_hidden: 0 },
    ];
    store.allLinks = [
      { id: 1, title: "Grafana (friend)", category_id: 5, tags: [{ id: 4, name: "infra" }] },
      { id: 2, title: "Grafana (mine)", category_id: 6, tags: [{ id: 4, name: "infra" }] },
      { id: 3, title: "Loose", category_id: null, tags: [] },
    ];
  });
  const ids = () => store.links.map((l) => l.id).sort();

  it("leaves their links out, and counts the matches it left out", () => {
    expect(ids()).toEqual([2, 3]);
    expect(store.total).toBe(2);
    expect(store.hiddenMatches).toBe(0);
    store.search = "grafana";
    expect(ids()).toEqual([2]);
    expect(store.hiddenMatches).toBe(1);
  });

  it("shows them on request, until the search changes", () => {
    store.search = "grafana";
    store.revealHidden();
    expect(store.showHidden).toBe(true);
    expect(ids()).toEqual([1, 2]);
    store.search = "friend";
    expect(store.showHidden).toBe(false);
    expect(ids()).toEqual([]);
    expect(store.hiddenMatches).toBe(1);
  });

  it("starts a new tag filter without hidden categories", () => {
    store.revealHidden();
    store.filterByTag(4);
    expect(store.showHidden).toBe(false);
    expect(ids()).toEqual([2]);
    expect(store.hiddenMatches).toBe(1);
  });

  it("shows a hidden category's links when you pick it", () => {
    store.filterCategory = "5";
    expect(ids()).toEqual([1]);
  });

  it("hides a category: its links leave the list at once", async () => {
    const category = store.categories[1];
    await store.toggleHidden(category);
    expect(categoriesApi.update).toHaveBeenCalledWith(6, { is_hidden: true });
    expect(category.is_hidden).toBe(1);
    expect(ids()).toEqual([3]);
    expect(linksApi.list).not.toHaveBeenCalled();
    expect(useToastStore().items.at(-1).message).toContain("Mine is hidden");
  });

  it("puts it back when hiding fails", async () => {
    const category = store.categories[1];
    categoriesApi.update.mockRejectedValueOnce(new Error("Nope"));
    await store.toggleHidden(category);
    expect(category.is_hidden).toBe(0);
    expect(ids()).toEqual([2, 3]);
  });
});

describe("app store sorting", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("sorts the list and remembers the choice for next time", () => {
    const store = useAppStore();
    store.allLinks = [{ id: 1, title: "beta" }, { id: 2, title: "Alpha" }];
    store.setSort("title");
    expect(store.links.map((l) => l.id)).toEqual([2, 1]);
    setActivePinia(createPinia());
    expect(useAppStore().sort).toBe("title");
  });

  it("falls back to your own order for unknown values", () => {
    const store = useAppStore();
    store.setSort("drop table");
    expect(store.sort).toBe("");
    localStorage.setItem("hiddenshelf_sort", "nonsense");
    setActivePinia(createPinia());
    expect(useAppStore().sort).toBe("");
  });
});
