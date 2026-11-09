import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useContextMenuStore } from "@/stores/contextMenu";
import { usePublicShareStore } from "@/stores/publicShare";
import LinkRowEdit from "@/components/links/LinkRowEdit.vue";

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("LinkRowEdit", () => {
  function mountRow(linkOverrides = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    return mount(LinkRowEdit, {
      global: { plugins: [pinia] },
      props: {
        link: {
          id: 1,
          title: "Example",
          url: "https://example.com",
          description: "A **bold** [site](https://x.y) note",
          is_public: 1,
          direct_redirect: 0,
          total_visits: 0,
          hash: "abc",
          tags: [],
          created_at: "2026-11-01T10:00:00Z",
          ...linkOverrides,
        },
      },
    });
  }

  it("shows the title and address in one row", () => {
    const wrapper = mountRow();
    expect(wrapper.element.tagName).toBe("LI");
    expect(wrapper.find('[title="Example"]').text()).toBe("Example");
    expect(wrapper.find('[title="https://example.com"]').text()).toBe("https://example.com");
  });

  it("shows the description as one plain line, without markdown", () => {
    const desc = mountRow().find('[data-testid="row-description"]');
    expect(desc.text()).toBe("A bold site note");
    expect(desc.find("a").exists()).toBe(false);
  });

  it("leaves the description out when there is none", () => {
    expect(mountRow({ description: "" }).find('[data-testid="row-description"]').exists()).toBe(false);
  });

  it("emits edit and delete from its icon buttons", async () => {
    const wrapper = mountRow();
    await wrapper.find('[data-testid="edit-link"]').trigger("click");
    await wrapper.find('[data-testid="trash-link"]').trigger("click");
    expect(wrapper.emitted("edit")[0][0]).toMatchObject({ id: 1 });
    expect(wrapper.emitted("delete")[0]).toEqual([1]);
    expect(wrapper.find('[data-testid="edit-link"]').attributes("title")).toBe("Edit Example");
    expect(wrapper.find('[data-testid="trash-link"]').attributes("title")).toBe("Move Example to the trash");
  });

  it("toggles the favorite", async () => {
    const wrapper = mountRow({ is_favorite: 0 });
    const appStore = useAppStore();
    appStore.toggleLinkFavorite = vi.fn();
    const star = wrapper.find('[data-testid="favorite-toggle"]');
    expect(star.attributes("aria-pressed")).toBe("false");
    await star.trigger("click");
    expect(appStore.toggleLinkFavorite).toHaveBeenCalled();
  });

  it("opens the share dialog for public links", async () => {
    const wrapper = mountRow({ is_public: 1, hash: "xyz" });
    expect(wrapper.find('[data-testid="private-indicator"]').exists()).toBe(false);
    await wrapper.find('[data-testid="public-indicator"]').trigger("click");
    expect(usePublicShareStore().link).toMatchObject({ hash: "xyz" });
  });

  it("shows a lock for private links", () => {
    const wrapper = mountRow({ is_public: 0 });
    expect(wrapper.find('[data-testid="private-indicator"]').attributes("title")).toBe(
      "Private: only you can see it",
    );
    expect(wrapper.find('[data-testid="public-indicator"]').exists()).toBe(false);
  });

  it("shows visits and the redirect mark for public links", () => {
    const wrapper = mountRow({ total_visits: 4, direct_redirect: 1 });
    expect(wrapper.find('[title="4 visits in total"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="redirect-indicator"]').exists()).toBe(true);
  });

  it("shows two tags and counts the rest; a tag filters the list", async () => {
    const wrapper = mountRow({
      tags: [
        { id: 1, name: "vue" },
        { id: 2, name: "test" },
        { id: 3, name: "more" },
      ],
    });
    const pills = wrapper.findAll('button[title^="Show links tagged"]');
    expect(pills.map((p) => p.text())).toEqual(["vue", "test"]);
    expect(wrapper.find('[title="more"]').text()).toBe("+1");
    await pills[0].trigger("click");
    expect(useAppStore().filterTag).toBe("1");
  });

  it("opens the link menu on right-click", async () => {
    const wrapper = mountRow();
    await wrapper.trigger("contextmenu");
    expect(useContextMenuStore().open).toBe(true);
  });
});
