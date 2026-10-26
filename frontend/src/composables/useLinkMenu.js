import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { useDialogStore } from "@/stores/dialog";
import { useContextMenuStore } from "@/stores/contextMenu";
import { appUrl } from "@/lib/appUrl";

/**
 * Right-click / long-press menu for a link card, shared by View and Edit.
 * Links from a category someone shared with you only get the read actions.
 *
 * @param {object} [options]
 * @param {(link) => void} [options.onEdit] opens the editor; without it,
 *   Edit goes to the Edit page with the link's editor open
 * @param {(link) => void} [options.onDetails] adds "Details" at the top
 */
export function useLinkMenu({ onEdit, onDetails } = {}) {
  const router = useRouter();
  const appStore = useAppStore();
  const toast = useToastStore();
  const dialog = useDialogStore();
  const menu = useContextMenuStore();

  async function copy(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  }

  // updateLink shows its own "Link updated" toast
  async function save(link, payload) {
    try {
      await appStore.updateLink(link.id, payload);
    } catch (error) {
      toast.error(error.message || "Couldn't update the link");
    }
  }

  async function setPosition(link) {
    const value = await dialog.prompt({
      title: "Set position",
      message: "Lower numbers come first in the category. Leave it empty for the default order.",
      value: link.display_order || "",
      inputType: "number",
      icon: "mdi-sort-numeric-variant",
    });
    if (value === null) return;
    await save(link, { display_order: value === "" ? null : Number(value) });
  }

  async function remove(link) {
    const ok = await dialog.confirmDelete({ title: `Delete "${link.title}"?` });
    if (ok) await appStore.deleteLink(link.id);
  }

  function items(link) {
    const own = !link.is_from_shared_category;
    const key = link.category_id || "uncategorized";
    const siblings = appStore.linksByCategory.get(key) || [];
    const position = siblings.findIndex((l) => l.id === link.id);
    return [
      {
        label: "Details",
        icon: "mdi-text-box-outline",
        hidden: !onDetails,
        action: () => onDetails(link),
      },
      {
        label: "Open in new tab",
        icon: "mdi-open-in-new",
        action: () => window.open(link.url, "_blank", "noopener"),
      },
      {
        label: "Copy URL",
        icon: "mdi-content-copy",
        action: () => copy(link.url, "URL copied"),
      },
      {
        label: "Copy public link",
        icon: "mdi-link-variant",
        hidden: !link.is_public || !link.hash,
        action: () => copy(appUrl(`/h/${link.hash}`), "Public link copied"),
      },
      { divider: true },
      {
        label: "Edit",
        icon: "mdi-pencil-outline",
        hidden: !own,
        action: () =>
          onEdit
            ? onEdit(link)
            : router.push({ name: "edit", query: { editId: link.id } }),
      },
      {
        label: "Move up",
        icon: "mdi-arrow-up",
        hidden: !own || position <= 0,
        action: () => appStore.moveLink(link, "up"),
      },
      {
        label: "Move down",
        icon: "mdi-arrow-down",
        hidden: !own || position === -1 || position >= siblings.length - 1,
        action: () => appStore.moveLink(link, "down"),
      },
      {
        label: "Set position…",
        icon: "mdi-sort-numeric-variant",
        hidden: !own,
        action: () => setPosition(link),
      },
      {
        label: "Reset position",
        icon: "mdi-sort-variant-remove",
        hidden: !own || link.display_order == null,
        action: () => save(link, { display_order: null }),
      },
      { divider: true },
      {
        label: "Delete",
        icon: "mdi-delete-outline",
        danger: true,
        hidden: !own,
        action: () => remove(link),
      },
    ];
  }

  function open(event, link) {
    menu.show(event, { title: link.title, items: items(link) });
  }

  return { open, items };
}
