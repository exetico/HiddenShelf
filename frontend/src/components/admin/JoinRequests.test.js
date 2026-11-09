import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useDialogStore } from "@/stores/dialog";
import JoinRequests from "@/components/admin/JoinRequests.vue";
import { reportDown, resetConnection, retryNow } from "@/lib/connection";

vi.mock("@/services/api/accessApi", () => ({
  accessApi: {
    adminList: vi.fn(),
    invite: vi.fn().mockResolvedValue({ success: true }),
    approve: vi.fn().mockResolvedValue({ success: true }),
    deny: vi.fn().mockResolvedValue({ success: true }),
    remove: vi.fn().mockResolvedValue({ success: true }),
  },
}));
import { accessApi } from "@/services/api/accessApi";

const entries = [
  { id: 1, email: "asker@example.com", status: "pending", note: "<b>Hi</b> from Sam", created_at: 1700000000 },
  { id: 2, email: "friend@example.com", status: "approved", note: null, created_at: 1700000000 },
  { id: 3, email: "no@example.com", status: "denied", note: null, created_at: 1700000000 },
];

async function mountPanel(overrides = {}) {
  accessApi.adminList.mockResolvedValue({ success: true, mode: "approval", configured_mode: "approval", entries, ...overrides });
  const wrapper = mount(JoinRequests);
  await flushPromises();
  return wrapper;
}

describe("JoinRequests", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("lists who is waiting, who is let in and who was denied", async () => {
    const w = await mountPanel();
    expect(w.find('[data-testid="waiting-count"]').text()).toBe("1 waiting");
    expect(w.findAll('[data-testid="waiting-entry"]')).toHaveLength(1);
    expect(w.findAll('[data-testid="invited-entry"]')).toHaveLength(1);
    expect(w.findAll('[data-testid="denied-entry"]')).toHaveLength(1);
    expect(w.find('[data-testid="join-mode"]').text()).toMatch(/approves them/);
  });

  it("shows a requester's note as text, never as markup", async () => {
    const w = await mountPanel();
    const item = w.find('[data-testid="waiting-entry"]');
    expect(item.text()).toContain("<b>Hi</b> from Sam");
    expect(item.find("b").exists()).toBe(false);
  });

  it("approves and denies", async () => {
    const w = await mountPanel();
    const buttons = w.find('[data-testid="waiting-entry"]').findAll("button");
    await buttons[0].trigger("click");
    await flushPromises();
    expect(accessApi.approve).toHaveBeenCalledWith(1);
    await buttons[1].trigger("click");
    await flushPromises();
    expect(accessApi.deny).toHaveBeenCalledWith(1);
    expect(accessApi.adminList).toHaveBeenCalledTimes(3);
  });

  it("adds an email to the list", async () => {
    const w = await mountPanel();
    await w.find("#invite-email").setValue("  new@example.com ");
    await w.find('[data-testid="invite-form"]').trigger("submit");
    await flushPromises();
    expect(accessApi.invite).toHaveBeenCalledWith("new@example.com");
    expect(w.find("#invite-email").element.value).toBe("");
  });

  it("asks before removing, and doesn't when cancelled", async () => {
    const w = await mountPanel();
    const dialog = useDialogStore();
    const confirm = vi.spyOn(dialog, "confirm").mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const remove = w.find('[data-testid="invited-entry"] button');
    await remove.trigger("click");
    await flushPromises();
    expect(accessApi.remove).not.toHaveBeenCalled();
    await remove.trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(accessApi.remove).toHaveBeenCalledWith(2);
  });

  it("warns when nobody could approve", async () => {
    const w = await mountPanel({ mode: "invite", configured_mode: "approval", entries: [] });
    expect(w.text()).toContain("UPDATE_ADMIN_EMAILS");
  });

  it("shows a load error", async () => {
    accessApi.adminList.mockRejectedValue(new Error("Not found"));
    const w = mount(JoinRequests);
    await flushPromises();
    expect(w.text()).toContain("Not found");
  });

  it("says calmly when the server is restarting, and loads again once it's back", async () => {
    resetConnection();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    accessApi.adminList.mockRejectedValueOnce(
      Object.assign(new Error("Can't reach the server right now."), { unreachable: true }),
    );
    const w = mount(JoinRequests);
    await flushPromises();
    const error = w.find('[data-testid="load-error"]');
    expect(error.text()).toContain("Waiting for the server");
    expect(error.classes()).not.toContain("text-red-600");

    accessApi.adminList.mockResolvedValue({ success: true, mode: "approval", configured_mode: "approval", entries });
    reportDown();
    await retryNow();
    await flushPromises();
    expect(w.find('[data-testid="load-error"]').exists()).toBe(false);
    expect(w.findAll('[data-testid="waiting-entry"]')).toHaveLength(1);
    w.unmount();
    resetConnection();
    vi.unstubAllGlobals();
  });

  it("Try again loads the list again", async () => {
    accessApi.adminList.mockRejectedValueOnce(new Error("Boom"));
    const w = mount(JoinRequests);
    await flushPromises();
    expect(w.find('[data-testid="load-error"]').text()).toContain("Boom");
    accessApi.adminList.mockResolvedValue({ success: true, mode: "approval", configured_mode: "approval", entries });
    await w.find('[data-testid="load-error-retry"]').trigger("click");
    await flushPromises();
    expect(w.findAll('[data-testid="waiting-entry"]')).toHaveLength(1);
  });
});
