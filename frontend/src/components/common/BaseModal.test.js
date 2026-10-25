import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import BaseModal from "@/components/common/BaseModal.vue";

describe("BaseModal", () => {
  const mountModal = (props = {}) =>
    mount(BaseModal, {
      props: { open: true, title: "Edit link", ...props },
      slots: { default: "<p>Body</p>" },
      global: { stubs: { Teleport: true } },
    });

  it("renders title and body when open", () => {
    const wrapper = mountModal();
    expect(wrapper.text()).toContain("Edit link");
    expect(wrapper.text()).toContain("Body");
  });

  it("is a bottom sheet on phones and centered from sm up", () => {
    const backdrop = mountModal().find('[role="dialog"]');
    expect(backdrop.classes()).toEqual(
      expect.arrayContaining(["items-end", "sm:items-center"]),
    );
  });

  it("caps its height so long content scrolls", () => {
    const wrapper = mountModal();
    expect(wrapper.find('[tabindex="-1"]').classes()).toContain("max-h-[90dvh]");
    expect(wrapper.find("section").classes()).toContain("overflow-y-auto");
  });

  it("closes on the close button and on backdrop click", async () => {
    const wrapper = mountModal();
    await wrapper.find("header button").trigger("click");
    await wrapper.find('[role="dialog"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(2);
  });
});
