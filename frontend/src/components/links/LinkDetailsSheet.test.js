import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { useLinkDetailsStore } from "@/stores/linkDetails";
import { useDialogStore } from "@/stores/dialog";
import { usePublicShareStore } from "@/stores/publicShare";
import LinkDetailsSheet from "@/components/links/LinkDetailsSheet.vue";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,QR") },
}));

const links = [
  {
    id: 1,
    title: "Grafana",
    url: "https://grafana.example.com",
    description: "**Dashboards** for the servers",
    category_id: 5,
    tags: [{ id: 7, name: "infra" }],
    is_public: 1,
    hash: "abc",
    total_visits: 3,
    created_at: "2026-01-02 10:00:00",
  },
  { id: 2, title: "Docs", url: "https://docs.example.com", tags: [] },
];

describe("LinkDetailsSheet", () => {
  let pinia, details, wrapper;
  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    useAppStore().categories = [{ id: 5, name: "Servers", color: "#f00" }];
    details = useLinkDetailsStore();
    wrapper = mount(LinkDetailsSheet, {
      global: { plugins: [pinia], stubs: { Teleport: true, Transition: false } },
      attachTo: document.body,
    });
    details.open(links, links[0]);
    await flushPromises();
  });

  it("shows everything about the link", () => {
    const text = wrapper.text();
    expect(text).toContain("Grafana");
    expect(text).toContain("https://grafana.example.com");
    expect(wrapper.find(".md-content strong").text()).toBe("Dashboards");
    expect(text).toContain("Servers");
    expect(text).toContain("#infra");
    expect(text).toContain("Public");
    expect(text).toContain("3 visits");
    expect(wrapper.find('[data-testid="details-position"]').text()).toBe("1 of 2");
    wrapper.unmount();
  });

  it("goes to the next and previous link with buttons and arrow keys", async () => {
    await wrapper.find('[aria-label="Next link"]').trigger("click");
    expect(wrapper.text()).toContain("Docs");
    expect(wrapper.text()).toContain("No description");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    await flushPromises();
    expect(wrapper.text()).toContain("Grafana");
    wrapper.unmount();
  });

  it("swipes to the next link and ignores vertical scrolling", async () => {
    const panel = wrapper.find('[data-testid="link-details"] > div');
    await panel.trigger("touchstart", { touches: [{ clientX: 300, clientY: 100 }] });
    await panel.trigger("touchend", { changedTouches: [{ clientX: 300, clientY: 300 }] });
    expect(details.index).toBe(0);
    await panel.trigger("touchstart", { touches: [{ clientX: 300, clientY: 100 }] });
    await panel.trigger("touchend", { changedTouches: [{ clientX: 150, clientY: 110 }] });
    expect(details.index).toBe(1);
    wrapper.unmount();
  });

  it("filters by a tag and closes", async () => {
    const appStore = useAppStore();
    appStore.filterByTag = vi.fn();
    await wrapper.find('[title="Show links tagged infra"]').trigger("click");
    expect(appStore.filterByTag).toHaveBeenCalledWith(7);
    expect(details.current).toBeNull();
    wrapper.unmount();
  });

  it("has real actions instead of a menu: edit goes to the editor", async () => {
    expect(wrapper.find('[aria-label="More actions"]').exists()).toBe(false);
    await wrapper.find('[title="Edit this link"]').trigger("click");
    expect(details.current).toBeNull();
    // Opens over the page you're on instead of going to the Edit page
    expect(useLinkEditorStore().link).toMatchObject({ id: 1 });
    wrapper.unmount();
  });

  it("asks before moving the link to the trash, and only closes if it did", async () => {
    const appStore = useAppStore();
    appStore.deleteLink = vi.fn().mockResolvedValue();
    await wrapper.find('[aria-label="Move to trash"]').trigger("click");
    const dialog = useDialogStore();
    expect(dialog.current.title).toBe('Move "Grafana" to the trash?');
    dialog.close(false);
    await flushPromises();
    expect(appStore.deleteLink).not.toHaveBeenCalled();
    expect(details.current).not.toBeNull();

    await wrapper.find('[aria-label="Move to trash"]').trigger("click");
    dialog.close(true);
    await flushPromises();
    expect(appStore.deleteLink).toHaveBeenCalledWith(1);
    expect(details.current).toBeNull();
    wrapper.unmount();
  });

  it("stars the link", async () => {
    const appStore = useAppStore();
    appStore.toggleLinkFavorite = vi.fn();
    const star = wrapper.find('[data-testid="details-favorite"]');
    expect(star.attributes("title")).toBe("Add to favorites");
    await star.trigger("click");
    expect(appStore.toggleLinkFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
    wrapper.unmount();
  });

  it("opens the QR code for a public link", async () => {
    await wrapper.find('[title="Show a QR code and embed code for the public link"]').trigger("click");
    expect(usePublicShareStore().link).toMatchObject({ id: 1 });
    wrapper.unmount();
  });

  it("offers no QR, edit or trash where they don't apply", async () => {
    details.open([{ id: 9, title: "Theirs", url: "https://x.com", is_from_shared_category: 1 }], {
      id: 9,
    });
    await flushPromises();
    expect(wrapper.find('[title="Show a QR code and embed code for the public link"]').exists()).toBe(false);
    expect(wrapper.find('[title="Edit this link"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Move to trash"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="details-favorite"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("closes on Escape", async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.find('[data-testid="link-details"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
