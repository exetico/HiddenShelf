import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connection,
  onReconnect,
  reportDown,
  resetConnection,
  retryNow,
  whenUp,
} from "@/lib/connection";

const healthy = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
const gateway = () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError("html"); } });

describe("connection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetConnection();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("checks the health endpoint, slower each time, until the server answers", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(gateway()).mockRejectedValueOnce(new TypeError("Load failed")).mockResolvedValue(healthy());
    vi.stubGlobal("fetch", fetchMock);
    const reconnected = vi.fn();
    onReconnect(reconnected);

    reportDown();
    expect(connection.down).toBe(true);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    // Then 4s
    await vi.advanceTimersByTimeAsync(3999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(connection.down).toBe(true);
    // Then 8s, and it's back
    await vi.advanceTimersByTimeAsync(8000);
    expect(connection.down).toBe(false);
    expect(reconnected).toHaveBeenCalledTimes(1);
  });

  it("a health answer that isn't the app's own ok doesn't count as up", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
    reportDown();
    await vi.advanceTimersByTimeAsync(2000);
    expect(connection.down).toBe(true);
  });

  it("Try now checks at once, and whenUp resolves when the server is back", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(healthy()));
    reportDown();
    const up = vi.fn();
    whenUp().then(up);
    await retryNow();
    await Promise.resolve();
    expect(connection.down).toBe(false);
    expect(up).toHaveBeenCalled();
  });

  it("whenUp resolves at once when nothing is wrong", async () => {
    await expect(whenUp()).resolves.toBeUndefined();
  });

  it("a page brought back from the browser's memory loads again", () => {
    const fn = vi.fn();
    const stop = onReconnect(fn);
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(fn).toHaveBeenCalledTimes(1);
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
  });
});
