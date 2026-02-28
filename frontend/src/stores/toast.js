import { defineStore } from "pinia";

let nextId = 1;

export const useToastStore = defineStore("toast", {
  state: () => ({
    items: [],
  }),
  actions: {
    push(type, message) {
      const id = nextId++;
      this.items.push({ id, type, message });
      window.setTimeout(() => this.remove(id), 3500);
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
