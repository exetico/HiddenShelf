import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import LinkCardEdit from "@/components/links/LinkCardEdit.vue";

describe("LinkCardEdit", () => {
  it("renders link title and emits edit", async () => {
    const wrapper = mount(LinkCardEdit, {
      props: {
        link: {
          id: 1,
          title: "Example",
          url: "https://example.com",
          description: "desc",
          is_public: 1,
          hash: "abc",
          tags: [],
        },
      },
    });

    expect(wrapper.text()).toContain("Example");
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("edit")).toHaveLength(1);
  });
});
