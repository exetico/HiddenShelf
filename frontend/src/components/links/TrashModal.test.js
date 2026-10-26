import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { useDialogStore } from "@/stores/dialog";
import TrashModal from "@/components/links/TrashModal.vue";

vi.mock("@/services/api/linksApi", () => ({
  linksApi: {
    trash: vi.fn(),
    restore: vi.fn().mockResolvedValue({}),
    deleteForever: vi.fn().mockResolvedValue({}),
    emptyTrash: vi.fn().mockResolvedValue({}),
  },
}));
import { linksApi } from "@/services/api/linksApi";

const trashed = () => [
  { id: 4, title: "Old docs", deleted_at: "2026-10-20 08:00:00", category_name: "Work" },
  { id: 5, title: "Recipe", deleted_at: "2026-10-19 08:00:00" },
];

describe("TrashModal", () => {
  let pinia;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    linksApi.trash.mockResolvedValue({ links: trashed(), days: 30 });
    useAppStore().refreshLinks = vi.fn();
  });

  const mountTrash = async () => {
    const wrapper = mount(TrashModal, {
      props: { open: true },
      global: {
        plugins: [pinia],
        stubs: { BaseModal: { template: "<div><slot /></div>", props: ["open", "title"] } },
      },
    });
    await flushPromises();
    return wrapper;
  };

  it("lists deleted links and how long they're kept", async () => {
    const wrapper = await mountTrash();
    expect(wrapper.text()).toContain("stay here for 30 days");
    const items = wrapper.findAll('[data-testid="trash-item"]');
    expect(items.map((i) => i.find("p").text())).toEqual(["Old docs", "Recipe"]);
    expect(items[0].text()).toContain("Work");
  });

  it("restores a link onto the shelf", async () => {
    const wrapper = await mountTrash();
    await wrapper.find('[title="Put Old docs back on the shelf"]').trigger("click");
    await flushPromises();
    expect(linksApi.restore).toHaveBeenCalledWith(4);
    expect(useAppStore().refreshLinks).toHaveBeenCalled();
    expect(wrapper.findAll('[data-testid="trash-item"]')).toHaveLength(1);
  });

  it("asks before deleting one for good", async () => {
    const wrapper = await mountTrash();
    await wrapper.find('[aria-label="Delete Recipe for good"]').trigger("click");
    const dialog = useDialogStore();
    expect(dialog.current.title).toBe('Delete "Recipe" for good?');
    dialog.close(true);
    await flushPromises();
    expect(linksApi.deleteForever).toHaveBeenCalledWith(5);
    expect(wrapper.findAll('[data-testid="trash-item"]')).toHaveLength(1);
  });

  it("empties the trash after asking", async () => {
    const wrapper = await mountTrash();
    await wrapper.find('[title="Delete everything in the trash for good"]').trigger("click");
    const dialog = useDialogStore();
    expect(dialog.current.message).toContain("2 links are deleted for good");
    dialog.close(false);
    await flushPromises();
    expect(linksApi.emptyTrash).not.toHaveBeenCalled();

    await wrapper.find('[title="Delete everything in the trash for good"]').trigger("click");
    dialog.close(true);
    await flushPromises();
    expect(linksApi.emptyTrash).toHaveBeenCalled();
    expect(wrapper.text()).toContain("The trash is empty.");
  });
});
