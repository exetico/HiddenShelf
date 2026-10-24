import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";

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
    authApi.me.mockResolvedValue({ email: "test@example.com" });
    const store = useAuthStore();

    await store.bootstrap();

    expect(store.user.email).toBe("test@example.com");
    expect(store.isAuthenticated).toBe(true);
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
