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

  it("shows the description as Markdown with the tags, under the link", async () => {
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
    preview.rect = { top: 100, bottom: 120, left: 50 };
    await flushPromises();
    const card = wrapper.find('[data-testid="link-preview"]');
    expect(card.findAll("li").map((li) => li.text())).toEqual(["one", "two"]);
    expect(card.text()).toContain("#infra");
    expect(card.attributes("style")).toContain("top: 124px");
  });
});
