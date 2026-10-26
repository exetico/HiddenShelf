import { defineStore } from "pinia";

/**
 * One app-wide dialog for simple questions and notices.
 *
 *   if (await useDialogStore().confirm({ title: "Delete?", message: "..." })) ...
 *   await useDialogStore().alert({ title: "Done", message: "..." });
 *
 * Both return a promise: confirm resolves true or false, alert resolves
 * when it is closed. ConfirmDialog.vue (mounted in App.vue) shows it.
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
          resolve,
        };
      });
    },
    confirm(options = {}) {
      return this.open("confirm", options);
    },
    alert(options = {}) {
      return this.open("alert", options).then(() => undefined);
    },
    close(result) {
      const dialog = this.current;
      this.current = null;
      dialog?.resolve(result);
    },
  },
});
