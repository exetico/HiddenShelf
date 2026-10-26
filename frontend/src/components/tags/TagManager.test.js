import { beforeEach, describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useDialogStore } from "@/stores/dialog";
import TagManager from "@/components/tags/TagManager.vue";

describe("TagManager", () => {
  let pinia;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  const mountManager = () =>
    mount(TagManager, {
      props: { open: true, tags: [{ id: 9, name: "infra" }] },
      global: { plugins: [pinia], stubs: { Teleport: true } },
    });

  it("deletes a tag only after the shared dialog confirms", async () => {
    const wrapper = mountManager();
    await wrapper.findAll("button").find((b) => b.text() === "Delete").trigger("click");
    const dialog = useDialogStore();
    expect(dialog.current).toMatchObject({ title: 'Delete tag "infra"?', danger: true });

    dialog.close(false);
    await flushPromises();
    expect(wrapper.emitted("remove")).toBeFalsy();

    await wrapper.findAll("button").find((b) => b.text() === "Delete").trigger("click");
    dialog.close(true);
    await flushPromises();
    expect(wrapper.emitted("remove")).toEqual([[9]]);
  });
});
