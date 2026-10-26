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

  it("prompt resolves the typed text, or null when cancelled", async () => {
    const dialog = useDialogStore();
    const answer = dialog.prompt({ title: "Position", value: 3 });
    expect(dialog.current).toMatchObject({ kind: "prompt", confirmText: "Save", value: 3 });
    dialog.current.value = "7";
    dialog.close(true);
    await expect(answer).resolves.toBe("7");

    const cancelled = dialog.prompt({ title: "Position" });
    dialog.close(false);
    await expect(cancelled).resolves.toBeNull();
  });

  it("confirmDelete is a red Delete question", () => {
    const dialog = useDialogStore();
    dialog.confirmDelete({ title: "Delete x?" });
    expect(dialog.current).toMatchObject({
      title: "Delete x?",
      confirmText: "Delete",
      danger: true,
      message: "This can't be undone.",
    });
  });
});
