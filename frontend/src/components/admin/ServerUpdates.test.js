import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useDialogStore } from "@/stores/dialog";
import { useAuthStore } from "@/stores/auth";
import ServerUpdates from "@/components/admin/ServerUpdates.vue";

vi.mock("@/services/api/updatesApi", () => ({
  updatesApi: { status: vi.fn(), update: vi.fn(), rollback: vi.fn(), check: vi.fn() },
}));
vi.mock("@/services/api/authApi", () => ({
  authApi: {
    logout: vi.fn().mockResolvedValue({}),
    me: vi.fn(),
    sendMagicLink: vi.fn().mockResolvedValue({}),
    googleSignInUrl: vi.fn().mockResolvedValue("https://accounts.google.com/o/oauth2/v2/auth?x=1"),
  },
}));
vi.mock("@/services/api/configApi", () => ({
  configApi: { get: vi.fn().mockResolvedValue({ email_login_enabled: true, google_auth_enabled: true }) },
}));
import { updatesApi } from "@/services/api/updatesApi";
import { authApi } from "@/services/api/authApi";

const A = "a".repeat(40);
const B = "b".repeat(40);

function status(overrides = {}) {
  return {
    success: true,
    built_commit: A,
    fresh_login: true,
    reauth_minutes: 10,
    updater_seen: true,
    updater_stale: false,
    checked_at: 1700000000,
    check_ok: true,
    check_error: "",
    branch: "main",
    channel: "main",
    current: { commit: A, date: 1700000000, subject: "First version" },
    available: { target: B, count: 1, migrations: true, commits: [{ commit: B, date: 1, subject: "Add <b>stuff</b>" }] },
    job: null,
    rollback: null,
    log: "",
    history: [],
    ...overrides,
  };
}

describe("ServerUpdates", () => {
  let pinia;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  const mountIt = () => mount(ServerUpdates, { global: { plugins: [pinia] } });

  // Answer the next confirm dialog
  async function answer(value) {
    await flushPromises();
    const dialog = useDialogStore();
    const current = dialog.current;
    dialog.current = null;
    current.resolve(value);
    await flushPromises();
    return current;
  }

  it("shows the running version and the incoming changes as text", async () => {
    updatesApi.status.mockResolvedValue(status());
    const wrapper = mountIt();
    await flushPromises();
    expect(wrapper.find('[data-testid="update-version"]').text()).toContain("aaaaaaa");
    const list = wrapper.find('[data-testid="update-available"]');
    expect(list.text()).toContain("1 new change on main");
    expect(list.text()).toContain("Add <b>stuff</b>");
    expect(list.find("b").exists()).toBe(false);
    expect(wrapper.find('[data-testid="update-button"]').attributes("disabled")).toBeUndefined();
  });

  it("starts an update for the version shown, after confirming", async () => {
    updatesApi.status.mockResolvedValue(status());
    updatesApi.update.mockResolvedValue({ id: "f".repeat(32) });
    const wrapper = mountIt();
    await flushPromises();
    await wrapper.find('[data-testid="update-button"]').trigger("click");
    const asked = await answer(true);
    expect(asked.title).toBe("Update the app?");
    expect(updatesApi.update).toHaveBeenCalledWith();
    expect(wrapper.find('[data-testid="update-progress"]').exists()).toBe(true);
  });

  it("stops waiting when the request's history row gets a result", async () => {
    const id = "f".repeat(32);
    updatesApi.status.mockResolvedValue(status());
    updatesApi.update.mockResolvedValue({ id });
    vi.useFakeTimers();
    const wrapper = mountIt();
    await flushPromises();
    await wrapper.find('[data-testid="update-button"]').trigger("click");
    await answer(true);
    expect(wrapper.find('[data-testid="update-progress"]').exists()).toBe(true);
    // The updater's run has its own id; the history row carries the result
    updatesApi.status.mockResolvedValue(
      status({
        available: { target: null, count: 0, commits: [] },
        job: { id: "9".repeat(32), action: "update", state: "failed", message: "Build failed", finished_at: 2 },
        history: [{ id, action: "update", target_commit: B, email: "a@example.com", created_at: 1, result: "failed", message: "Build failed" }],
      }),
    );
    await vi.advanceTimersByTimeAsync(3500);
    await flushPromises();
    expect(wrapper.find('[data-testid="update-progress"]').exists()).toBe(false);
  });

  it("checks for updates now and shows what it found", async () => {
    updatesApi.status.mockResolvedValue(status({ available: { target: null, count: 0, commits: [] } }));
    updatesApi.check.mockResolvedValue({ checked_at: 1700000000 });
    vi.useFakeTimers();
    const wrapper = mountIt();
    await flushPromises();
    const button = wrapper.find('[data-testid="check-button"]');
    expect(button.text()).toContain("Check for updates");
    await button.trigger("click");
    await flushPromises();
    expect(updatesApi.check).toHaveBeenCalledWith();
    expect(wrapper.find('[data-testid="check-button"]').text()).toContain("Checking");
    updatesApi.status.mockResolvedValue(status({ checked_at: 1700000100 }));
    await vi.advanceTimersByTimeAsync(3500);
    await flushPromises();
    expect(wrapper.find('[data-testid="check-button"]').text()).toContain("Check for updates");
    expect(wrapper.find('[data-testid="update-available"]').text()).toContain("1 new change");
  });

  it("does nothing when the admin cancels", async () => {
    updatesApi.status.mockResolvedValue(status());
    const wrapper = mountIt();
    await flushPromises();
    await wrapper.find('[data-testid="update-button"]').trigger("click");
    await answer(false);
    expect(updatesApi.update).not.toHaveBeenCalled();
  });

  it("asks you to confirm who you are, without signing you out", async () => {
    updatesApi.status.mockResolvedValue(status({ fresh_login: false }));
    const logout = vi.spyOn(useAuthStore(), "logout").mockResolvedValue();
    useAuthStore().user = { email: "admin@example.com" };
    const wrapper = mountIt();
    await flushPromises();
    const box = wrapper.find('[data-testid="reauth"]');
    expect(box.text()).toContain("Confirm it's you");
    expect(box.text()).not.toMatch(/sign out/i);
    expect(wrapper.find('[data-testid="update-button"]').attributes("disabled")).toBeDefined();

    await wrapper.find('[data-testid="reauth-email"]').trigger("click");
    await flushPromises();
    expect(authApi.sendMagicLink).toHaveBeenCalledWith("admin@example.com", { returnTo: "#/admin" });
    expect(wrapper.find('[data-testid="reauth-sent"]').text()).toContain("admin@example.com");
    expect(logout).not.toHaveBeenCalled();
    expect(updatesApi.update).not.toHaveBeenCalled();
  });

  it("confirms with Google and comes back to the admin page", async () => {
    updatesApi.status.mockResolvedValue(status({ fresh_login: false }));
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    try {
      const wrapper = mountIt();
      await flushPromises();
      await wrapper.find('[data-testid="reauth-google"]').trigger("click");
      await flushPromises();
      expect(authApi.googleSignInUrl).toHaveBeenCalledWith({ returnTo: "#/admin" });
      expect(assign).toHaveBeenCalledWith(expect.stringContaining("accounts.google.com"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("follows releases: names the version on offer, or why there is none", async () => {
    updatesApi.status.mockResolvedValue(
      status({
        channel: "releases",
        current: { commit: A, date: 1, subject: "First version", tag: "v1.1.0" },
        available: { target: B, target_tag: "v1.2.0", count: 2, commits: [] },
      }),
    );
    let wrapper = mountIt();
    await flushPromises();
    expect(wrapper.find('[data-testid="update-channel"]').text()).toContain("Releases");
    expect(wrapper.find('[data-testid="current-tag"]').text()).toBe("v1.1.0");
    expect(wrapper.find('[data-testid="update-available"]').text()).toContain("v1.2.0 is available (2 changes)");

    updatesApi.status.mockResolvedValue(status({ channel: "releases", available: { target: A, target_tag: null, count: 0, commits: [] } }));
    wrapper = mountIt();
    await flushPromises();
    expect(wrapper.find('[data-testid="up-to-date"]').text()).toContain("You're up to date. New versions show up here when they are released.");
    expect(wrapper.text()).not.toMatch(/publish/i);

    updatesApi.status.mockResolvedValue(
      status({ channel: "releases", available: { target: A, target_tag: "v1.0.0", ahead: true, count: 0, commits: [] } }),
    );
    wrapper = mountIt();
    await flushPromises();
    expect(wrapper.find('[data-testid="up-to-date"]').text()).toContain("You're up to date: this server runs a newer version than the latest release (v1.0.0)");
  });

  it("asks for make up when the updater is older than the web app", async () => {
    updatesApi.status.mockResolvedValue(
      status({ channel: "main", updater_outdated: true, available: { target: A, count: 0, commits: [] } }),
    );
    const wrapper = mountIt();
    await flushPromises();
    expect(wrapper.find('[data-testid="updater-outdated"]').text()).toContain("make up");
    expect(wrapper.find('[data-testid="update-channel"]').text()).toContain("Every change on main");
    expect(wrapper.find('[data-testid="up-to-date"]').text()).toBe("You're on the latest version.");
  });

  it("warns that a rollback with a database change loses newer data", async () => {
    updatesApi.status.mockResolvedValue(
      status({ available: { target: null, count: 0, commits: [] }, rollback: { commit: A, subject: "x", restores_database: true } }),
    );
    updatesApi.rollback.mockResolvedValue({ id: "e".repeat(32) });
    const wrapper = mountIt();
    await flushPromises();
    expect(wrapper.text()).toContain("You're on the latest version");
    expect(wrapper.find('[data-testid="update-button"]').attributes("disabled")).toBeDefined();
    await wrapper.find('[data-testid="rollback-button"]').trigger("click");
    const asked = await answer(true);
    expect(asked.message).toContain("anything saved since then is lost");
    expect(updatesApi.rollback).toHaveBeenCalled();
  });

  it("tells you when the updater isn't installed", async () => {
    updatesApi.status.mockResolvedValue(
      status({ updater_seen: false, updater_stale: true, check_ok: false, current: null, available: { count: 0, commits: [] } }),
    );
    const wrapper = mountIt();
    await flushPromises();
    expect(wrapper.find('[data-testid="updater-missing"]').text()).toContain("hasn't checked in yet");
    expect(wrapper.find('[data-testid="update-button"]').attributes("disabled")).toBeDefined();
  });

  it("shows the last result and who updated when", async () => {
    updatesApi.status.mockResolvedValue(
      status({
        job: { id: "d".repeat(32), action: "update", state: "rolled_back", message: "Health check failed", finished_at: 1 },
        history: [{ id: "d".repeat(32), action: "update", target_commit: B, email: "admin@example.com", created_at: 1, result: "rolled_back" }],
      }),
    );
    const wrapper = mountIt();
    await flushPromises();
    expect(wrapper.find('[data-testid="update-result"]').text()).toContain("Rolled back");
    expect(wrapper.find('[data-testid="update-history"]').text()).toContain("admin@example.com");
  });
});
