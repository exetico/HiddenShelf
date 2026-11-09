import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ConnectionStatus from "@/components/feedback/ConnectionStatus.vue";
import { connection, reportDown, resetConnection } from "@/lib/connection";

describe("ConnectionStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetConnection();
  });
  afterEach(() => {
    resetConnection();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows nothing while the server answers", () => {
    const w = mount(ConnectionStatus);
    expect(w.find('[data-testid="connection-status"]').exists()).toBe(false);
  });

  it("says the server may be restarting, counts down, and goes away once it's back", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const w = mount(ConnectionStatus);
    reportDown();
    await nextTick();
    const box = w.find('[data-testid="connection-status"]');
    expect(box.text()).toContain("Can't reach the server.");
    expect(box.text()).toContain("restarting");
    expect(box.text()).toMatch(/Trying again in 2s/);

    await w.find('[data-testid="connection-retry"]').trigger("click");
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(fetchMock).toHaveBeenCalled();
    expect(connection.down).toBe(false);
    expect(w.find('[data-testid="connection-status"]').exists()).toBe(false);
  });
});
