import { defineStore } from "pinia";

let nextId = 1;
const TOAST_DURATION = 3500;

export const useToastStore = defineStore("toast", {
  state: () => ({
    items: [],
  }),
  actions: {
    // `action` adds a button to the toast, like { label: "Undo", run }
    push(type, message, { action = null, duration = TOAST_DURATION } = {}) {
      const id = nextId++;
      this.items.push({
        id,
        type,
        message,
        action,
        duration,
        createdAt: Date.now(),
      });
      window.setTimeout(() => this.remove(id), duration);
    },
    async runAction(item) {
      this.remove(item.id);
      await item.action?.run();
    },
    remove(id) {
      this.items = this.items.filter((item) => item.id !== id);
    },
    success(message, options) {
      this.push("success", message, options);
    },
    error(message) {
      this.push("error", message);
    },
    info(message) {
      this.push("info", message);
    },
  },
});
