import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useContextMenuStore } from "@/stores/contextMenu";
import { usePublicShareStore } from "@/stores/publicShare";
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
    await wrapper.find('[title="Edit Example"]').trigger("click");
    expect(wrapper.emitted("edit")).toHaveLength(1);
  });

  it("shows a Share chip for public links that opens the public link dialog", async () => {
    const wrapper = mountCard({ is_public: 1, hash: "xyz123" });
    const globe = wrapper.find('[data-testid="public-indicator"]');
    expect(globe.attributes("title")).toBe("Public link: copy it, show a QR code or embed it");
    // Labelled, with the QR icon, so it reads as a button and says what it does
    expect(globe.text()).toBe("Share");
    expect(globe.find(".mdi-earth").exists()).toBe(true);
    expect(globe.find(".mdi-qrcode").exists()).toBe(true);
    expect(wrapper.find('[data-testid="private-indicator"]').exists()).toBe(false);
    await globe.trigger("click");
    expect(usePublicShareStore().link).toMatchObject({ hash: "xyz123" });
  });

  it("shows a lock for private links, with nothing to copy", () => {
    const wrapper = mountCard({ is_public: 0 });
    expect(wrapper.find('[data-testid="private-indicator"]').attributes("title")).toBe(
      "Private: only you can see it",
    );
    expect(wrapper.find('[data-testid="public-indicator"]').exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/🔓|🔒|Copy public URL/);
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

    const filled = mountCard({ description: "My link" }).find(".md-content");
    expect(filled.classes()).not.toContain("hidden");
  });

  it("renders the description's Markdown", () => {
    const wrapper = mountCard({ description: "**Fast** and `simple`" });
    expect(wrapper.find(".md-content").html()).toContain("<strong>Fast</strong>");
    expect(wrapper.find(".md-content code").text()).toBe("simple");
  });

  it("lets long titles and URLs shrink instead of overflowing the card", () => {
    const wrapper = mountCard({ url: "https://example.com/" + "x".repeat(200) });
    expect(wrapper.classes()).toContain("min-w-0");
    expect(wrapper.find("h3").classes()).toContain("truncate");
  });

  it("marks a direct redirect with an icon only, for public links", () => {
    const wrapper = mountCard({ direct_redirect: 1, is_public: 1 });
    const bolt = wrapper.find('[data-testid="redirect-indicator"]');
    expect(bolt.attributes("title")).toContain("Direct redirect");
    expect(wrapper.text()).not.toContain("redirect");
    // It only matters for the public link
    expect(
      mountCard({ direct_redirect: 1, is_public: 0 })
        .find('[data-testid="redirect-indicator"]')
        .exists(),
    ).toBe(false);
  });

  it("hides direct redirect indicator when not set", () => {
    const wrapper = mountCard({ direct_redirect: 0 });
    expect(wrapper.find('[data-testid="redirect-indicator"]').exists()).toBe(false);
  });

  it("shows when the link was added", () => {
    const wrapper = mountCard({ created_at: "2025-10-03 12:00:00" });
    const expected = new Date("2025-10-03T12:00:00Z").toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(wrapper.find(`[title="Added ${expected}"]`).text()).toBe(expected);
  });

  it("stars the link", async () => {
    const wrapper = mountCard();
    const appStore = useAppStore();
    appStore.toggleLinkFavorite = vi.fn();
    const star = wrapper.find('[data-testid="favorite-toggle"]');
    expect(star.attributes("title")).toBe("Add to favorites");
    await star.trigger("click");
    expect(appStore.toggleLinkFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(mountCard({ is_favorite: 1 }).find(".mdi-star").exists()).toBe(true);
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
      "Add to favorites",
      "Edit Example",
      "Move Example to the trash",
      "Public link: copy it, show a QR code or embed it",
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
