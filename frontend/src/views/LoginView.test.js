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

const loginMethods = { email_login_enabled: true, google_auth_enabled: true };
vi.mock("@/services/api/configApi", () => ({
  configApi: { get: vi.fn(() => Promise.resolve({ ...loginMethods })) },
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
    loginMethods.email_login_enabled = true;
    loginMethods.google_auth_enabled = true;
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

  it("shows email input for unauthenticated user", async () => {
    const wrapper = mountLogin({});
    await flushPromises();
    const emailInput = wrapper.find('input[type="email"]');
    expect(emailInput.exists()).toBe(true);
  });

  it("shows the tagline and feature list when no remembered email", async () => {
    const wrapper = mountLogin({});
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain("Your private shelf for links");
    expect(text).toContain("What you get");
    expect(text).toContain("Share collections");
    expect(text).toContain("Private by default");
    expect(text).not.toContain("Your data stays yours");
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

  it("shows only Google when email login is off", async () => {
    loginMethods.email_login_enabled = false;
    localStorage.setItem("hiddenshelf_email", "remembered@example.com");
    const wrapper = mountLogin({});
    await flushPromises();

    const text = wrapper.text();
    expect(wrapper.find('input[type="email"]').exists()).toBe(false);
    expect(text).not.toContain("Send magic link");
    // Only the button says it, not a subtitle above it as well
    expect(text.split("Sign in with Google")).toHaveLength(2);
  });

  it("hides Google when it isn't configured", async () => {
    loginMethods.google_auth_enabled = false;
    const wrapper = mountLogin({});
    await flushPromises();

    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Sign in with Google");
  });

  it("says so when no login method is enabled", async () => {
    loginMethods.email_login_enabled = false;
    loginMethods.google_auth_enabled = false;
    const wrapper = mountLogin({});
    await flushPromises();

    expect(wrapper.text()).toContain("Login isn't set up on this server yet.");
  });
});
