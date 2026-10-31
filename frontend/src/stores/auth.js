import { defineStore } from "pinia";
import { authApi } from "@/services/api/authApi";
import { useToastStore } from "@/stores/toast";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    ready: false,
    user: null,
    // May update the app from Profile (server-side admin allowlist)
    canUpdate: false,
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
        const { user, welcome, canUpdate } = await authApi.me();
        this.user = user;
        this.canUpdate = Boolean(canUpdate);
        if (welcome) {
          useToastStore().success(
            welcome === "new" ? "Welcome to Hidden Shelf!" : "Welcome back!",
          );
        }
      } catch {
        this.user = null;
        this.canUpdate = false;
      } finally {
        this.ready = true;
      }
    },
    async logout() {
      await authApi.logout();
      this.user = null;
      // Full reload into the login page, so no signed-in state lingers
      window.location.assign(`${import.meta.env.BASE_URL}login`);
    },
  },
});
