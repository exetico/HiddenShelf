import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import AdminView from "@/views/AdminView.vue";

vi.mock("@/services/api/updatesApi", () => ({
  updatesApi: { status: vi.fn(() => new Promise(() => {})) },
}));

describe("AdminView", () => {
  it("holds the server updates panel", () => {
    const wrapper = mount(AdminView, { global: { plugins: [createPinia()] } });
    expect(wrapper.find("h1").text()).toBe("Admin");
    expect(wrapper.find('[data-testid="server-updates"]').exists()).toBe(true);
  });
});
