import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useLinkDetailsStore } from "@/stores/linkDetails";
import { useContextMenuStore } from "@/stores/contextMenu";
import LinkDetailsSheet from "@/components/links/LinkDetailsSheet.vue";

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

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

  it("hands over to the link menu for edit, move and delete", async () => {
    await wrapper.find('[aria-label="More actions"]').trigger("click");
    expect(details.current).toBeNull();
    expect(useContextMenuStore().title).toBe("Grafana");
    wrapper.unmount();
  });

  it("closes on Escape", async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.find('[data-testid="link-details"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
