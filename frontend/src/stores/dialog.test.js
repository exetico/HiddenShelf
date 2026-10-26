import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDialogStore } from "@/stores/dialog";

describe("dialog store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("confirm resolves true on confirm and false on cancel", async () => {
    const dialog = useDialogStore();
    const yes = dialog.confirm({ title: "Go?" });
    expect(dialog.current).toMatchObject({
      kind: "confirm",
      title: "Go?",
      confirmText: "Confirm",
      cancelText: "Cancel",
    });
    dialog.close(true);
    await expect(yes).resolves.toBe(true);
    expect(dialog.current).toBeNull();

    const no = dialog.confirm();
    dialog.close(false);
    await expect(no).resolves.toBe(false);
  });

  it("alert has its own defaults and resolves when closed", async () => {
    const dialog = useDialogStore();
    const done = dialog.alert({ message: "Saved" });
    expect(dialog.current).toMatchObject({
      kind: "alert",
      title: "Notice",
      confirmText: "OK",
      message: "Saved",
    });
    dialog.close(true);
    await expect(done).resolves.toBeUndefined();
  });

  it("a new dialog cancels the one still open", async () => {
    const dialog = useDialogStore();
    const first = dialog.confirm({ title: "First" });
    dialog.confirm({ title: "Second" });
    await expect(first).resolves.toBe(false);
    expect(dialog.current.title).toBe("Second");
  });
});
