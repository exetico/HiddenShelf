import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";

vi.mock("@/services/api/linksApi", () => ({
  linksApi: { list: vi.fn() },
}));
vi.mock("@/services/api/settingsApi", () => ({
  settingsApi: { get: vi.fn(), update: vi.fn() },
}));

import { linksApi } from "@/services/api/linksApi";
import { settingsApi } from "@/services/api/settingsApi";

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
