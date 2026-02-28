import { defineStore } from "pinia";
import { authApi } from "@/services/api/authApi";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    ready: false,
    user: null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    initials: (state) => {
      if (!state.user?.email) return "U";
      return (
        state.user.email
          .split("@")[0]
          .split(/[._-]/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join("") || "U"
      );
    },
  },
  actions: {
    async bootstrap() {
      try {
        this.user = await authApi.me();
      } catch {
        this.user = null;
      } finally {
        this.ready = true;
      }
    },
    async logout() {
      await authApi.logout();
      this.user = null;
      window.location.href = "/public/login.html";
    },
  },
});
