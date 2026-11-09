import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetAnswers,
  request,
  revalidated,
  UNREACHABLE_MESSAGE,
  UNREADABLE_MESSAGE,
} from "@/lib/httpClient";
import { connection, resetConnection } from "@/lib/connection";

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

describe("httpClient when the server can't be reached", () => {
  beforeEach(() => resetConnection());
  afterEach(() => {
    resetConnection();
    vi.unstubAllGlobals();
  });

  const html = (status) => ({
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token <");
    },
  });

  it.each([502, 503, 504, 521, 522])("a proxy's %i page means the server is restarting", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(html(status)));
    const error = await request("/api/access/admin").catch((e) => e);
    expect(error.unreachable).toBe(true);
    expect(error.message).toBe(UNREACHABLE_MESSAGE);
    expect(connection.down).toBe(true);
  });

  it("no network at all counts as unreachable too", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Load failed")));
    const error = await request("/api/updates").catch((e) => e);
    expect(error.unreachable).toBe(true);
    expect(connection.down).toBe(true);
  });

  it("the app's own 503 is an ordinary error with its message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ success: false, error: "Could not reach the updater." }) }),
    );
    const error = await request("/api/updates").catch((e) => e);
    expect(error.unreachable).toBeUndefined();
    expect(error.message).toBe("Could not reach the updater.");
    expect(error.status).toBe(503);
    expect(connection.down).toBe(false);
  });

  it("any other answer that isn't JSON is unreadable, and starts no reconnect loop", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ...html(200), ok: true }));
    const error = await request("/api/x").catch((e) => e);
    expect(error.unreachable).toBeUndefined();
    expect(error.message).toBe(UNREADABLE_MESSAGE);
    expect(connection.down).toBe(false);
  });

  it("a cancelled request stays a cancel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })));
    const error = await request("/api/x").catch((e) => e);
    expect(error.name).toBe("AbortError");
    expect(connection.down).toBe(false);
  });

  it("the shelf load reports a restart the same way", async () => {
    forgetAnswers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ...html(502), headers: new Headers() }));
    const error = await revalidated("/api/links").catch((e) => e);
    expect(error.unreachable).toBe(true);
  });
});
