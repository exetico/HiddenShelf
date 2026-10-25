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

describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Mock window.location.hash to prevent redirect loops in tests
    delete window.location;
    window.location = { hash: "" };
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
    expect(window.location.hash).toBe("#/login");
    expect(authApi.logout).toHaveBeenCalled();
  });
});
