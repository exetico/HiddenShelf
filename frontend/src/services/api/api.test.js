import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/httpClient", () => ({ request: vi.fn() }));

import { request } from "@/lib/httpClient";
import { categoriesApi } from "@/services/api/categoriesApi";
import { sharesApi } from "@/services/api/sharesApi";
import { linksApi } from "@/services/api/linksApi";

describe("API clients", () => {
  beforeEach(() => {
    request.mockReset();
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

  it("sends tag_id only when filtering by tag", async () => {
    request.mockResolvedValue({ links: [] });
    await linksApi.list({ tagId: 7 });
    expect(request.mock.calls[0][0]).toContain("tag_id=7");
    await linksApi.list({});
    expect(request.mock.calls[1][0]).not.toContain("tag_id");
  });

  it("asks for hidden categories only when told to", async () => {
    request.mockResolvedValue({ links: [] });
    await linksApi.list({ includeHidden: true });
    expect(request.mock.calls[0][0]).toContain("include_hidden=1");
    await linksApi.list({});
    expect(request.mock.calls[1][0]).not.toContain("include_hidden");
  });
});
