import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";
import LoginView from "@/views/LoginView.vue";

// Mock API
vi.mock("@/services/api/authApi", () => ({
  authApi: {
    sendMagicLink: vi.fn().mockResolvedValue({}),
    me: vi.fn(),
    verifyToken: vi.fn(),
    getGoogleAuthUrl: vi
      .fn()
      .mockResolvedValue({ url: "https://google.com/auth" }),
  },
}));

// Mock vue-router
const mockRoute = { query: {} };
const mockReplace = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ replace: mockReplace }),
}));

describe("LoginView", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    mockRoute.query = {};
    mockReplace.mockClear();
    sessionStorage.clear();
    localStorage.clear();
  });

  function mountLogin(routeQuery = {}) {
    mockRoute.query = routeQuery;
    return mount(LoginView, {
      global: { plugins: [pinia] },
    });
  }

  it("stores share code from URL in sessionStorage", () => {
    mountLogin({ share: "abc123" });
    expect(sessionStorage.getItem("hiddenshelf_pending_share")).toBe("abc123");
  });

  it("does not store share code when absent", () => {
    mountLogin({});
    expect(sessionStorage.getItem("hiddenshelf_pending_share")).toBeNull();
  });

  it("redirects authenticated user to home", () => {
    const authStore = useAuthStore();
    authStore.user = { email: "test@example.com" };

    mountLogin({});
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("stores share code even if user is authenticated and redirecting", () => {
    const authStore = useAuthStore();
    authStore.user = { email: "test@example.com" };

    mountLogin({ share: "xyz789" });
    expect(sessionStorage.getItem("hiddenshelf_pending_share")).toBe("xyz789");
    expect(mockReplace).toHaveBeenCalled();
  });

  it("shows email input for unauthenticated user", () => {
    const wrapper = mountLogin({});
    const emailInput = wrapper.find('input[type="email"]');
    expect(emailInput.exists()).toBe(true);
  });
});
