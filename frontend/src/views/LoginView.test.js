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

  it('shows "Sign in with your email" when no remembered email', () => {
    const wrapper = mountLogin({});
    const text = wrapper.text();
    expect(text).toContain("Sign in with your email");
    expect(text).not.toContain("Welcome back");
  });

  it('shows "Welcome back" with email and user icon when email is remembered', async () => {
    localStorage.setItem("hiddenshelf_email", "test@example.com");
    const wrapper = mountLogin({});
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain("Welcome back");
    expect(text).toContain("test@example.com");

    // Check for user icon
    const userIcon = wrapper.find(".mdi-account-circle");
    expect(userIcon.exists()).toBe(true);
  });

  it("shows sign-in buttons when remembered email exists", async () => {
    localStorage.setItem("hiddenshelf_email", "remembered@example.com");
    const wrapper = mountLogin({});
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain("Welcome back");
    expect(text).toContain("remembered@example.com");
    expect(text).toContain("Send magic link");
    expect(text).toContain("Sign in with Google");
    expect(text).toContain("Use a different email");
  });
});
