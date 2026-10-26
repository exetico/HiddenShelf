import { beforeEach, describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useLinkPreviewStore } from "@/stores/linkPreview";
import LinkPreviewPopover from "@/components/links/LinkPreviewPopover.vue";

describe("LinkPreviewPopover", () => {
  let pinia;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("shows the description as Markdown with the tags, beside the icon", async () => {
    const wrapper = mount(LinkPreviewPopover, {
      global: { plugins: [pinia], stubs: { Teleport: true } },
    });
    expect(wrapper.find('[data-testid="link-preview"]').exists()).toBe(false);
    const preview = useLinkPreviewStore();
    preview.link = {
      id: 1,
      description: "- one\n- two",
      tags: [{ id: 2, name: "infra" }],
    };
    window.innerWidth = 1400;
    window.innerHeight = 900;
    preview.rect = { top: 100, bottom: 116, left: 50, right: 66 };
    await flushPromises();
    const card = wrapper.find('[data-testid="link-preview"]');
    expect(card.findAll("li").map((li) => li.text())).toEqual(["one", "two"]);
    expect(card.text()).toContain("#infra");
    // To the right of the icon, level with it: the rows below stay visible
    expect(card.attributes("style")).toContain("left: 74px");
    expect(card.attributes("style")).toContain("top: 92px");
  });

  it("goes left of the icon near the right edge, and shows the date", async () => {
    const wrapper = mount(LinkPreviewPopover, {
      global: { plugins: [pinia], stubs: { Teleport: true } },
    });
    window.innerWidth = 1400;
    window.innerHeight = 900;
    const preview = useLinkPreviewStore();
    preview.link = { id: 1, description: "x", created_at: "2025-10-03 12:00:00" };
    preview.rect = { top: 880, bottom: 896, left: 1300, right: 1316 };
    await flushPromises();
    const style = wrapper.find('[data-testid="link-preview"]').attributes("style");
    expect(style).toContain("left: 932px");
    // Kept on screen at the bottom
    expect(style).toContain("top: 604px");
    expect(wrapper.text()).toContain("Added");
  });
});
