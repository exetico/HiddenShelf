import { describe, expect, it, vi } from "vitest";
import { request } from "@/lib/httpClient";

describe("httpClient", () => {
  it("returns payload when request succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { value: 1 } }),
      }),
    );

    const payload = await request("/api/test");
    expect(payload.data.value).toBe(1);
  });

  it("throws backend error message when success is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: false, error: "Boom" }),
      }),
    );

    await expect(request("/api/test")).rejects.toThrow("Boom");
  });
});
