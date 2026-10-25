import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import LinkCardEdit from "@/components/links/LinkCardEdit.vue";

describe("LinkCardEdit", () => {
  function mountCard(linkOverrides = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);

    return mount(LinkCardEdit, {
      global: {
        plugins: [pinia],
      },
      props: {
        link: {
          id: 1,
          title: "Example",
          url: "https://example.com",
          description: "desc",
          is_public: 1,
          direct_redirect: 0,
          total_visits: 0,
          hash: "abc",
          tags: [],
          ...linkOverrides,
        },
      },
    });
  }

  it("renders link title and emits edit", async () => {
    const wrapper = mountCard();

    expect(wrapper.text()).toContain("Example");
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("edit")).toHaveLength(1);
  });

  it("shows 🔓 emoji for public links", () => {
    const wrapper = mountCard({ is_public: 1 });
    expect(wrapper.text()).toContain("🔓");
    expect(wrapper.text()).not.toContain("🔒");
  });

  it("shows 🔒 emoji for private links", () => {
    const wrapper = mountCard({ is_public: 0 });
    expect(wrapper.text()).toContain("🔒");
    expect(wrapper.text()).not.toContain("🔓");
  });

  it("shows Copy public URL button for public links", () => {
    const wrapper = mountCard({ is_public: 1 });
    expect(wrapper.text()).toContain("Copy public URL");
  });

  it("hides Copy public URL button for private links", () => {
    const wrapper = mountCard({ is_public: 0 });
    expect(wrapper.text()).not.toContain("Copy public URL");
  });

  it("emits copyPublic with hash when Copy public URL is clicked", async () => {
    const wrapper = mountCard({ is_public: 1, hash: "xyz123" });
    const copyBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Copy public URL"));
    await copyBtn.trigger("click");
    expect(wrapper.emitted("copyPublic")[0]).toEqual(["xyz123"]);
  });

  it("emits delete with id when Delete is clicked", async () => {
    const wrapper = mountCard();
    const deleteBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Delete");
    await deleteBtn.trigger("click");
    expect(wrapper.emitted("delete")[0]).toEqual([1]);
  });

  it("renders tags as pills", () => {
    const wrapper = mountCard({
      tags: [
        { id: 1, name: "vue" },
        { id: 2, name: "test" },
      ],
    });
    expect(wrapper.text()).toContain("vue");
    expect(wrapper.text()).toContain("test");
  });

  it("shows description or fallback", () => {
    const wrapper = mountCard({ description: "" });
    expect(wrapper.text()).toContain("No description");

    const wrapper2 = mountCard({ description: "My link" });
    expect(wrapper2.text()).toContain("My link");
  });

  it("shows direct redirect indicator when direct_redirect is set", () => {
    const wrapper = mountCard({ direct_redirect: 1 });
    expect(wrapper.text()).toContain("redirect");
  });

  it("hides direct redirect indicator when not set", () => {
    const wrapper = mountCard({ direct_redirect: 0 });
    expect(wrapper.text()).not.toContain("redirect");
  });

  it("shows visit count for public links with visits", () => {
    const wrapper = mountCard({ is_public: 1, total_visits: 42 });
    expect(wrapper.text()).toContain("42");
    expect(wrapper.find('[title="42 visits in total"]').exists()).toBe(true);
  });

  it("hides visit count when zero visits", () => {
    const wrapper = mountCard({ is_public: 1, total_visits: 0 });
    expect(wrapper.find(".mdi-eye-outline").exists()).toBe(false);
  });
});
