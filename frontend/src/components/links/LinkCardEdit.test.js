import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useContextMenuStore } from "@/stores/contextMenu";
import LinkCardEdit from "@/components/links/LinkCardEdit.vue";

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

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

  it("hides the 'No description' placeholder on phones only", () => {
    const empty = mountCard({ description: "" }).find("p.text-sm");
    expect(empty.classes()).toEqual(expect.arrayContaining(["hidden", "sm:block"]));

    const filled = mountCard({ description: "My link" }).find("p.text-sm");
    expect(filled.classes()).not.toContain("hidden");
  });

  it("lets long titles and URLs shrink instead of overflowing the card", () => {
    const wrapper = mountCard({ url: "https://example.com/" + "x".repeat(200) });
    expect(wrapper.classes()).toContain("min-w-0");
    expect(wrapper.find("h3").classes()).toContain("truncate");
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

  it("filters by a tag when you click it", async () => {
    const wrapper = mountCard({
      tags: [
        { id: 7, name: "infra" },
        { id: 8, name: "docs" },
      ],
    });
    const appStore = useAppStore();
    appStore.filterByTag = vi.fn();
    const tag = wrapper.findAll("button").find((b) => b.text() === "infra");
    expect(tag.attributes("title")).toBe("Show links tagged infra");
    await tag.trigger("click");
    expect(appStore.filterByTag).toHaveBeenCalledWith(7);
  });

  it("highlights the tag that is filtered on and counts hidden tags", () => {
    const tags = ["a", "b", "c", "d", "e"].map((name, i) => ({ id: i + 1, name }));
    const wrapper = mountCard({ tags });
    useAppStore().filterTag = "1";
    return wrapper.vm.$nextTick().then(() => {
      const a = wrapper.findAll("button").find((b) => b.text() === "a");
      expect(a.classes()).toContain("bg-brand-600!");
      const more = wrapper.findAll("span").find((s) => s.text() === "+2");
      expect(more.attributes("title")).toBe("d, e");
    });
  });

  it("has hover titles on its actions", () => {
    const wrapper = mountCard();
    const titles = wrapper.findAll("button").map((b) => b.attributes("title"));
    expect(titles).toEqual([
      "Edit Example",
      "Delete Example",
      "Copy the public link to the clipboard",
    ]);
  });

  it("opens the link menu on right-click, with Edit wired to the editor", async () => {
    const wrapper = mountCard();
    await wrapper.find("article").trigger("contextmenu", { clientX: 5, clientY: 6 });
    const menu = useContextMenuStore();
    expect(menu.open).toBe(true);
    expect(menu.title).toBe("Example");
    await menu.run(menu.items.find((i) => i.label === "Edit"));
    expect(wrapper.emitted("edit")[0][0]).toMatchObject({ id: 1 });
  });
});
