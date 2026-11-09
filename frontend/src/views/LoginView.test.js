import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import { authApi } from "@/services/api/authApi";
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
vi.mock("vue-router", async () => {
  const { h } = await vi.importActual("vue");
  return {
    useRoute: () => mockRoute,
    useRouter: () => ({ replace: mockReplace }),
    RouterLink: { props: ["to"], setup: (props, { slots }) => () => h("a", { href: props.to }, slots.default?.()) },
  };
});

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
    delete loginMethods.signup_mode;
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

  it("shows the front-page features and links to all of them and the FAQ", async () => {
    const wrapper = mountLogin({});
    await flushPromises();
    const { FRONT_FEATURES } = await import("@/content/features");
    const titles = wrapper.findAll('[aria-labelledby="features-heading"] h3').map((t) => t.text());
    expect(titles).toEqual(FRONT_FEATURES.map((f) => f.title));
    expect(titles).toContain("Shelf tools");
    expect(wrapper.find('[data-testid="login-help-link"]').attributes("href")).toBe("/help");
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

  it("draws the shelf art behind the page", () => {
    const wrapper = mountLogin({});
    const art = wrapper.find('[data-testid="shelf-backdrop"]');
    expect(art.exists()).toBe(true);
    expect(art.attributes("aria-hidden")).toBe("true");
  });

  it("shows the server's wait message calmly when links were asked for too often", async () => {
    const message =
      "A sign-in link was already sent to this address. Check your inbox and spam folder, or ask for a new one in 1 minute.";
    authApi.sendMagicLink.mockRejectedValueOnce(
      Object.assign(new Error(message), { status: 429 }),
    );
    const wrapper = mountLogin({});
    await flushPromises();
    await wrapper.find('input[type="email"]').setValue("me@example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    const toasts = useToastStore().items;
    expect(toasts.at(-1)).toMatchObject({ type: "info", message });
    // Still on the form, so they can try again later
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
  });

  describe("when sign-up isn't open", () => {
    it("says new people can ask to join", async () => {
      loginMethods.signup_mode = "approval";
      const wrapper = mountLogin();
      await flushPromises();
      expect(wrapper.find('[data-testid="join-hint"]').text()).toMatch(/ask to join/);
    });

    it("says it's by invitation only", async () => {
      loginMethods.signup_mode = "invite";
      const wrapper = mountLogin();
      await flushPromises();
      expect(wrapper.find('[data-testid="join-hint"]').text()).toMatch(/invitation only/);
    });

    it("says nothing when anyone can join", async () => {
      loginMethods.signup_mode = "open";
      const wrapper = mountLogin();
      await flushPromises();
      expect(wrapper.find('[data-testid="join-hint"]').exists()).toBe(false);
    });
  });
});
