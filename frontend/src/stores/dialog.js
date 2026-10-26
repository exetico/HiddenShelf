import { defineStore } from "pinia";

/**
 * One app-wide dialog for simple questions and notices.
 *
 *   if (await useDialogStore().confirm({ title: "Delete?", message: "..." })) ...
 *   await useDialogStore().alert({ title: "Done", message: "..." });
 *   const name = await useDialogStore().prompt({ title: "Name?", value: "x" });
 *
 * All return a promise: confirm resolves true or false, alert resolves
 * when it is closed, prompt resolves the text or null when cancelled. ConfirmDialog.vue (mounted in App.vue) shows it.
 */
export const useDialogStore = defineStore("dialog", {
  state: () => ({
    current: null,
  }),
  actions: {
    open(kind, options) {
      // A new dialog cancels one that is still open
      this.current?.resolve(false);
      return new Promise((resolve) => {
        this.current = {
          kind,
          title: options.title || (kind === "alert" ? "Notice" : "Are you sure?"),
          message: options.message || "",
          confirmText: options.confirmText || (kind === "alert" ? "OK" : "Confirm"),
          cancelText: options.cancelText || "Cancel",
          danger: options.danger === true,
          icon: options.icon || null,
          value: options.value ?? "",
          inputType: options.inputType || "text",
          placeholder: options.placeholder || "",
          resolve,
        };
      });
    },
    confirm(options = {}) {
      return this.open("confirm", options);
    },
    /** Standard "Delete X?" question, red confirm button */
    confirmDelete({ title, message, confirmText = "Delete" } = {}) {
      return this.open("confirm", {
        title,
        message: message || "This can't be undone.",
        confirmText,
        danger: true,
        icon: "mdi-delete-outline",
      });
    },
    alert(options = {}) {
      return this.open("alert", options).then(() => undefined);
    },
    prompt(options = {}) {
      return this.open("prompt", { confirmText: "Save", ...options });
    },
    close(result) {
      const dialog = this.current;
      this.current = null;
      if (dialog?.kind === "prompt") {
        dialog.resolve(result ? String(dialog.value) : null);
      } else {
        dialog?.resolve(result);
      }
    },
  },
});
