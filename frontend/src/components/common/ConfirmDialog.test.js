import { beforeEach, describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useDialogStore } from "@/stores/dialog";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";

describe("ConfirmDialog", () => {
  let pinia;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  const mountDialog = () =>
    mount(ConfirmDialog, {
      global: { plugins: [pinia], stubs: { Teleport: true } },
      attachTo: document.body,
    });

  it("renders nothing until asked", () => {
    expect(mountDialog().find('[role="alertdialog"]').exists()).toBe(false);
  });

  it("shows the question and resolves with the button pressed", async () => {
    const wrapper = mountDialog();
    const answer = useDialogStore().confirm({
      title: "Add to favorites?",
      message: "Work will be pinned",
      confirmText: "Add",
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Add to favorites?");
    expect(wrapper.text()).toContain("Work will be pinned");
    const buttons = wrapper.findAll("button");
    expect(buttons.map((b) => b.text())).toEqual(["Cancel", "Add"]);
    expect(buttons.every((b) => b.attributes("title"))).toBe(true);
    await buttons[1].trigger("click");
    await expect(answer).resolves.toBe(true);
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("cancels on Escape and on a backdrop tap", async () => {
    const wrapper = mountDialog();
    const dialog = useDialogStore();
    const first = dialog.confirm({ title: "One" });
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect(first).resolves.toBe(false);

    const second = dialog.confirm({ title: "Two" });
    await flushPromises();
    await wrapper.find('[role="alertdialog"]').trigger("click");
    await expect(second).resolves.toBe(false);
    wrapper.unmount();
  });

  it("an alert has a single OK button", async () => {
    const wrapper = mountDialog();
    useDialogStore().alert({ title: "Heads up", message: "Done" });
    await flushPromises();
    expect(wrapper.findAll("button").map((b) => b.text())).toEqual(["OK"]);
    wrapper.unmount();
  });
});
