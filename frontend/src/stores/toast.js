import { defineStore } from "pinia";

let nextId = 1;
const TOAST_DURATION = 3500;

export const useToastStore = defineStore("toast", {
  state: () => ({
    items: [],
  }),
  actions: {
    push(type, message) {
      const id = nextId++;
      this.items.push({
        id,
        type,
        message,
        duration: TOAST_DURATION,
        createdAt: Date.now(),
      });
      window.setTimeout(() => this.remove(id), TOAST_DURATION);
    },
    remove(id) {
      this.items = this.items.filter((item) => item.id !== id);
    },
    success(message) {
      this.push("success", message);
    },
    error(message) {
      this.push("error", message);
    },
    info(message) {
      this.push("info", message);
    },
  },
});
