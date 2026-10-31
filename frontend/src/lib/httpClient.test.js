import { describe, expect, it, vi } from "vitest";
import { forgetAnswers, request, revalidated } from "@/lib/httpClient";

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

  it("sends the last ETag and reuses the last answer on 304, keeping nothing on disk", async () => {
    forgetAnswers();
    const shelf = { success: true, links: [{ id: 1 }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: '"v1"' }),
        json: async () => shelf,
      })
      .mockResolvedValueOnce({ ok: false, status: 304, headers: new Headers() });
    vi.stubGlobal("fetch", fetchMock);

    expect(await revalidated("/api/links")).toBe(shelf);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store", headers: {} });

    // Unchanged: the same answer, from memory
    expect(await revalidated("/api/links")).toBe(shelf);
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ "If-None-Match": '"v1"' });
  });

  it("asks again in full if a 304 comes with nothing remembered", async () => {
    forgetAnswers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 304, headers: new Headers() })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, links: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);
    expect(await revalidated("/api/links")).toEqual({ success: true, links: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("passes caller headers through alongside the JSON content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await request("/api/x", { method: "POST", headers: { "X-Test": "1" }, body: "{}" });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json", "X-Test": "1" },
    });
  });
});
