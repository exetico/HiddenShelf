import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useDialogStore } from "@/stores/dialog";
import { useContextMenuStore } from "@/stores/contextMenu";
import { useLinkMenu } from "@/composables/useLinkMenu";

const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

const link = (overrides = {}) => ({
  id: 3,
  title: "Docs",
  url: "https://docs.example.com",
  hash: "abc",
  is_public: 1,
  display_order: 2,
  ...overrides,
});

describe("useLinkMenu", () => {
  let appStore;
  beforeEach(() => {
    setActivePinia(createPinia());
    appStore = useAppStore();
    appStore.deleteLink = vi.fn();
    appStore.updateLink = vi.fn();
    push.mockClear();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue() } });
  });

  const labels = (l, opts) => {
    useLinkMenu(opts).open({}, l);
    return useContextMenuStore().items.map((i) => i.label || "—");
  };

  it("offers everything for your own public link", () => {
    expect(labels(link())).toEqual([
      "Open in new tab",
      "Copy URL",
      "Copy public link",
      "—",
      "Edit",
      "Set position…",
      "Reset position",
      "—",
      "Delete",
    ]);
  });

  it("only offers read actions on a link shared with you", () => {
    expect(labels(link({ is_from_shared_category: 1, is_public: 0 }))).toEqual([
      "Open in new tab",
      "Copy URL",
    ]);
  });

  it("copies the public short link", async () => {
    const { items } = useLinkMenu();
    await items(link()).find((i) => i.label === "Copy public link").action();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/h/abc`,
    );
  });

  it("asks before it deletes", async () => {
    const { items } = useLinkMenu();
    items(link()).find((i) => i.label === "Delete").action();
    const dialog = useDialogStore();
    expect(dialog.current).toMatchObject({ title: 'Delete "Docs"?', danger: true });
    dialog.close(true);
    await flushPromises();
    expect(appStore.deleteLink).toHaveBeenCalledWith(3);
  });

  it("sets a position through the prompt", async () => {
    const { items } = useLinkMenu();
    items(link()).find((i) => i.label === "Set position…").action();
    const dialog = useDialogStore();
    expect(dialog.current).toMatchObject({ kind: "prompt", value: 2 });
    dialog.current.value = "5";
    dialog.close(true);
    await flushPromises();
    expect(appStore.updateLink).toHaveBeenCalledWith(3, { display_order: 5 });
  });

  it("edits on the Edit page, or with the given editor", () => {
    useLinkMenu().items(link()).find((i) => i.label === "Edit").action();
    expect(push).toHaveBeenCalledWith({ name: "edit", query: { editId: 3 } });
    const onEdit = vi.fn();
    useLinkMenu({ onEdit }).items(link()).find((i) => i.label === "Edit").action();
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });
});
