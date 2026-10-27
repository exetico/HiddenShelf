import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useDialogStore } from "@/stores/dialog";
import LinkFormModal from "@/components/links/LinkFormModal.vue";

vi.mock("@/services/api/linksApi", () => ({
  linksApi: { findDuplicates: vi.fn() },
}));
vi.mock("@/services/api/linkVisitsApi", () => ({
  linkVisitsApi: { getSummary: vi.fn().mockResolvedValue({}) },
}));

import { linksApi } from "@/services/api/linksApi";

const existing = { id: 4, title: "Docs", url: "https://docs.example.com", category_name: "Work" };

describe("LinkFormModal duplicate warning", () => {
  let pinia;
  beforeEach(() => {
    vi.useFakeTimers();
    pinia = createPinia();
    setActivePinia(pinia);
    linksApi.findDuplicates.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  const mountForm = (model = null) =>
    mount(LinkFormModal, {
      props: { open: true, model, categories: [] },
      global: { plugins: [pinia], stubs: { Teleport: true } },
    });

  async function typeUrl(wrapper, url) {
    await wrapper.find('[data-testid="link-url"]').setValue(url);
    vi.advanceTimersByTime(450);
    await flushPromises();
  }

  it("warns while you type a URL that's already saved", async () => {
    linksApi.findDuplicates.mockResolvedValue([existing]);
    const wrapper = mountForm();
    await typeUrl(wrapper, "https://docs.example.com/");
    expect(linksApi.findDuplicates).toHaveBeenCalledWith("https://docs.example.com/", undefined);
    const warning = wrapper.find("#duplicate-warning");
    expect(warning.text()).toContain("Already on your shelf as Docs in Work");
  });

  it("says nothing for a new URL and doesn't check half-typed ones", async () => {
    linksApi.findDuplicates.mockResolvedValue([]);
    const wrapper = mountForm();
    await typeUrl(wrapper, "https://doc");
    expect(linksApi.findDuplicates).not.toHaveBeenCalled();
    await typeUrl(wrapper, "https://new.example.com");
    expect(wrapper.find("#duplicate-warning").exists()).toBe(false);
  });

  it("asks before saving a duplicate, and saves on Save anyway", async () => {
    linksApi.findDuplicates.mockResolvedValue([existing]);
    const wrapper = mountForm();
    await wrapper.find('input[placeholder="Title"]').setValue("Docs again");
    await typeUrl(wrapper, "https://docs.example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    const dialog = useDialogStore();
    expect(dialog.current).toMatchObject({ title: "Already on your shelf", confirmText: "Save anyway" });
    expect(dialog.current.message).toContain('"Docs" in Work');
    expect(wrapper.emitted("save")).toBeFalsy();

    dialog.close(true);
    await flushPromises();
    expect(wrapper.emitted("save")[0][0]).toMatchObject({ url: "https://docs.example.com" });
  });

  it("goes back to the form when you choose Go back", async () => {
    linksApi.findDuplicates.mockResolvedValue([existing]);
    const wrapper = mountForm();
    await typeUrl(wrapper, "https://docs.example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    useDialogStore().close(false);
    await flushPromises();
    expect(wrapper.emitted("save")).toBeFalsy();
  });

  it("doesn't ask when editing a link without changing its URL", async () => {
    const wrapper = mountForm({ ...existing, id: 7, tags: [] });
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(linksApi.findDuplicates).not.toHaveBeenCalled();
    expect(wrapper.emitted("save")).toBeTruthy();
  });

  it("still saves when the check itself fails", async () => {
    linksApi.findDuplicates.mockRejectedValue(new Error("offline"));
    const wrapper = mountForm();
    await typeUrl(wrapper, "https://docs.example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.emitted("save")).toBeTruthy();
  });
});

describe("LinkFormModal description", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("previews the Markdown and goes back to editing", async () => {
    const wrapper = mount(LinkFormModal, {
      props: { open: true, model: null, categories: [] },
      global: { plugins: [createPinia()], stubs: { Teleport: true } },
    });
    await wrapper.find('textarea[placeholder="Description"]').setValue("**Hi** - there");
    await wrapper.findAll("button").find((b) => b.text() === "Preview").trigger("click");
    expect(wrapper.find('[data-testid="description-preview"] strong').text()).toBe("Hi");
    expect(wrapper.find("textarea").exists()).toBe(false);
    await wrapper.findAll("button").find((b) => b.text() === "Edit").trigger("click");
    expect(wrapper.find("textarea").element.value).toBe("**Hi** - there");
  });
});

describe("LinkFormModal filling in", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("starts empty each time it opens for a new link", async () => {
    const wrapper = mount(LinkFormModal, {
      props: { open: true, model: null, categories: [] },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find('input[placeholder="Title"]').setValue("Last one");
    await wrapper.find('[data-testid="link-url"]').setValue("https://last.example.com");
    // Saved and closed, then "Add link" again with the same empty model
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    expect(wrapper.find('input[placeholder="Title"]').element.value).toBe("");
    expect(wrapper.find('[data-testid="link-url"]').element.value).toBe("");
  });

  it("preselects the category and tags it's given", async () => {
    const wrapper = mount(LinkFormModal, {
      props: {
        open: true,
        model: { category_id: 2, tags: [{ name: "infra" }] },
        categories: [{ id: 1, name: "Work" }, { id: 2, name: "Home" }],
      },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.find("select").element.value).toBe("2");
    expect(wrapper.text()).toContain("infra");
    expect(wrapper.text()).toContain("Add Link");
  });

  it("completes an address typed without http://", async () => {
    const wrapper = mount(LinkFormModal, {
      props: { open: true, model: null, categories: [] },
      global: { stubs: { Teleport: true } },
    });
    // Found again each time: the Teleport stub re-creates its content
    const url = () => wrapper.find('[data-testid="link-url"]');
    // A plain text field, so the browser doesn't refuse "192.168.1.10:8123"
    expect(url().attributes("type")).toBe("text");
    expect(url().attributes("inputmode")).toBe("url");
    await url().setValue("192.168.1.10:8123");
    await url().trigger("blur");
    expect(url().element.value).toBe("http://192.168.1.10:8123");

    await wrapper.find('input[placeholder="Title"]').setValue("Home Assistant");
    await url().setValue("example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.emitted("save")[0][0].url).toBe("https://example.com");
  });
});
