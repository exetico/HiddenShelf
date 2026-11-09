import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useToastStore } from "@/stores/toast";
import JoinView from "@/views/JoinView.vue";
import { LIMITS } from "@/lib/limits";

vi.mock("@/services/api/accessApi", () => ({
  accessApi: { me: vi.fn(), ask: vi.fn() },
}));
vi.mock("vue-router", async () => {
  const { h } = await vi.importActual("vue");
  return {
    RouterLink: { props: ["to"], setup: (props, { slots }) => () => h("a", { href: props.to }, slots.default?.()) },
  };
});
import { accessApi } from "@/services/api/accessApi";

const base = { success: true, mode: "approval", email: "new@example.com", status: "none", can_ask: true };

async function mountWith(me) {
  accessApi.me.mockResolvedValue({ ...base, ...me });
  const wrapper = mount(JoinView);
  await flushPromises();
  return wrapper;
}

const state = (w) => w.find("[data-state]").attributes("data-state");

describe("JoinView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("asks to sign in first when no email was proved", async () => {
    const w = await mountWith({ email: null, status: null, can_ask: false });
    expect(state(w)).toBe("signin");
    expect(w.find('[data-testid="join-form"]').exists()).toBe(false);
  });

  it("shows the proved email and sends the note", async () => {
    accessApi.ask.mockResolvedValue({ success: true, status: "pending" });
    const w = await mountWith({});
    expect(w.text()).toContain("new@example.com");
    await w.find("textarea").setValue("  Hi, Sam here ");
    await w.find("form").trigger("submit");
    await flushPromises();
    expect(accessApi.ask).toHaveBeenCalledWith("Hi, Sam here");
    expect(state(w)).toBe("pending");
  });

  it("sends no note when it's empty", async () => {
    accessApi.ask.mockResolvedValue({ success: true, status: "pending" });
    const w = await mountWith({});
    await w.find("form").trigger("submit");
    await flushPromises();
    expect(accessApi.ask).toHaveBeenCalledWith(null);
  });

  it("caps the note at the server's limit", async () => {
    const w = await mountWith({});
    expect(Number(w.find("textarea").attributes("maxlength"))).toBe(LIMITS.joinNote);
  });

  it.each([
    [{ status: "pending", can_ask: false }, "pending"],
    [{ status: "denied", can_ask: false }, "denied"],
    [{ status: "approved", can_ask: false }, "approved"],
    [{ mode: "invite", can_ask: false }, "invite"],
    [{ mode: "open" }, "approved"],
  ])("shows %o as %s", async (me, expected) => {
    const w = await mountWith(me);
    expect(state(w)).toBe(expected);
    expect(w.find('[data-testid="join-form"]').exists()).toBe(false);
  });

  it("goes back to signing in when the sign-in has expired", async () => {
    accessApi.ask.mockRejectedValue(Object.assign(new Error("Sign in first"), { status: 401 }));
    const w = await mountWith({});
    await w.find("form").trigger("submit");
    await flushPromises();
    expect(state(w)).toBe("signin");
  });

  it("shows a too-many-requests answer calmly", async () => {
    accessApi.ask.mockRejectedValue(Object.assign(new Error("Try again later"), { status: 429 }));
    const w = await mountWith({});
    const toast = useToastStore();
    const info = vi.spyOn(toast, "info");
    await w.find("form").trigger("submit");
    await flushPromises();
    expect(info).toHaveBeenCalledWith("Try again later");
    expect(state(w)).toBe("ask");
  });
});
