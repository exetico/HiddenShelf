import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { useToastStore } from "@/stores/toast";
import LinkEditorHost from "@/components/links/LinkEditorHost.vue";

vi.mock("@/components/links/LinkFormModal.vue", () => ({
  default: {
    name: "LinkFormModal",
    template: "<div></div>",
    props: ["open", "model", "categories"],
    emits: ["close", "save"],
  },
}));

describe("LinkEditorHost", () => {
  let wrapper, editor, appStore;
  beforeEach(() => {
    setActivePinia(createPinia());
    appStore = useAppStore();
    appStore.categories = [{ id: 1, name: "Work" }];
    editor = useLinkEditorStore();
    wrapper = mount(LinkEditorHost);
  });
  const form = () => wrapper.findComponent({ name: "LinkFormModal" });

  it("opens the editor over the current page for the given link", async () => {
    expect(form().props("open")).toBe(false);
    editor.open({ id: 3, title: "Grafana" });
    await flushPromises();
    expect(form().props()).toMatchObject({
      open: true,
      model: { id: 3, title: "Grafana" },
      categories: [{ id: 1, name: "Work" }],
    });
  });

  it("saves the link and closes", async () => {
    appStore.updateLink = vi.fn().mockResolvedValue();
    editor.open({ id: 3 });
    await flushPromises();
    form().vm.$emit("save", { title: "New" });
    await flushPromises();
    expect(appStore.updateLink).toHaveBeenCalledWith(3, { title: "New" });
    expect(editor.link).toBeNull();
  });

  it("stays open and says why when saving fails", async () => {
    appStore.updateLink = vi.fn().mockRejectedValue(new Error("URL is invalid"));
    editor.open({ id: 3 });
    await flushPromises();
    form().vm.$emit("save", {});
    await flushPromises();
    expect(editor.link).toMatchObject({ id: 3 });
    expect(useToastStore().items.at(-1)).toMatchObject({ message: "URL is invalid" });
  });

  it("closes without saving", async () => {
    editor.open({ id: 3 });
    await flushPromises();
    form().vm.$emit("close");
    expect(editor.link).toBeNull();
  });
});
