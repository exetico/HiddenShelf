import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/httpClient", () => ({ request: vi.fn(), revalidated: vi.fn() }));

import { request, revalidated } from "@/lib/httpClient";
import { categoriesApi } from "@/services/api/categoriesApi";
import { sharesApi } from "@/services/api/sharesApi";
import { linksApi } from "@/services/api/linksApi";

describe("API clients", () => {
  beforeEach(() => {
    request.mockReset();
    revalidated.mockReset();
  });

  it("saves category order with PUT /api/categories/order", async () => {
    request.mockResolvedValue({});
    await categoriesApi.reorder([3, 1, 2]);
    expect(request).toHaveBeenCalledWith("/api/categories/order", {
      method: "PUT",
      body: JSON.stringify({ ids: [3, 1, 2] }),
    });
  });

  it("lists my own shares from ?owned=1", async () => {
    request.mockResolvedValue({ owned_shares: [{ id: 1 }] });
    expect(await sharesApi.listOwnedShares()).toEqual([{ id: 1 }]);
    expect(request).toHaveBeenCalledWith("/api/category_shares?owned=1");
  });

  it("returns an empty list when the server sends no owned shares", async () => {
    request.mockResolvedValue({});
    expect(await sharesApi.listOwnedShares()).toEqual([]);
  });

  it("asks for the whole shelf, shared and hidden categories included", async () => {
    revalidated.mockResolvedValue({ links: [] });
    await linksApi.list();
    const url = revalidated.mock.calls[0][0];
    expect(url).toContain("include_shared=1");
    expect(url).toContain("include_hidden=1");
    expect(url).not.toMatch(/limit|offset|page|search|tag_id/);
  });
});
