import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

vi.mock("@/services/api/authApi", () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn(),
  },
}));

import { authApi } from "@/services/api/authApi";

const connectionMock = vi.hoisted(() => ({ whenUp: vi.fn().mockResolvedValue() }));
vi.mock("@/lib/connection", () => connectionMock);

describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    connectionMock.whenUp.mockClear();
    // Mock window.location.hash to prevent redirect loops in tests
    delete window.location;
    window.location = { hash: "", assign: vi.fn() };
  });

  it("sets user when bootstrap succeeds", async () => {
    authApi.me.mockResolvedValue({
      user: { email: "test@example.com" },
      welcome: null,
    });
    const store = useAuthStore();

    await store.bootstrap();

    expect(store.user.email).toBe("test@example.com");
    expect(store.isAuthenticated).toBe(true);
    expect(store.canUpdate).toBe(false);
  });

  it("knows when the user may update the app", async () => {
    authApi.me.mockResolvedValue({ user: { email: "a@example.com" }, welcome: null, canUpdate: true });
    const store = useAuthStore();
    await store.bootstrap();
    expect(store.canUpdate).toBe(true);
  });

  it("greets once right after a login", async () => {
    authApi.me.mockResolvedValue({
      user: { email: "test@example.com" },
      welcome: "back",
    });
    const store = useAuthStore();

    await store.bootstrap();

    expect(useToastStore().items.map((t) => t.message)).toEqual([
      "Welcome back!",
    ]);
  });

  it("welcomes a new user", async () => {
    authApi.me.mockResolvedValue({
      user: { email: "new@example.com" },
      welcome: "new",
    });
    await useAuthStore().bootstrap();
    expect(useToastStore().items[0].message).toBe("Welcome to Hidden Shelf!");
  });

  it("doesn't greet on a normal page load", async () => {
    authApi.me.mockResolvedValue({
      user: { email: "test@example.com" },
      welcome: null,
    });
    await useAuthStore().bootstrap();
    expect(useToastStore().items).toEqual([]);
  });

  it("clears user when bootstrap fails", async () => {
    authApi.me.mockRejectedValue(new Error("unauthorized"));
    const store = useAuthStore();

    await store.bootstrap();

    expect(store.user).toBeNull();
    expect(store.ready).toBe(true);
  });

  it("redirects to login on logout", async () => {
    authApi.logout.mockResolvedValue({});
    const store = useAuthStore();
    store.user = { email: "test@example.com" };

    await store.logout();

    expect(store.user).toBeNull();
    expect(window.location.assign).toHaveBeenCalledWith("/login");
    expect(authApi.logout).toHaveBeenCalled();
  });

  it("waits for a server that is restarting instead of signing you out", async () => {
    const down = Object.assign(new Error("Can't reach the server"), { unreachable: true });
    authApi.me.mockRejectedValueOnce(down).mockResolvedValueOnce({ user: { email: "a@example.com" }, welcome: null });
    let backUp;
    connectionMock.whenUp.mockImplementationOnce(() => new Promise((r) => (backUp = r)));
    const store = useAuthStore();

    const done = store.bootstrap();
    await Promise.resolve();
    await Promise.resolve();
    // Still waiting: not ready, and nobody is treated as signed out
    expect(store.ready).toBe(false);
    expect(store.user).toBeNull();

    backUp();
    await done;
    expect(store.ready).toBe(true);
    expect(store.user.email).toBe("a@example.com");
  });

  it("any other failure still means signed out", async () => {
    authApi.me.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const store = useAuthStore();
    await store.bootstrap();
    expect(store.ready).toBe(true);
    expect(store.isAuthenticated).toBe(false);
    expect(connectionMock.whenUp).not.toHaveBeenCalled();
  });
});
