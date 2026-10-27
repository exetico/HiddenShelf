import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "@/views/DashboardView.vue";
import ViewLinksView from "@/views/ViewLinksView.vue";
import EditLinksView from "@/views/EditLinksView.vue";
import ProfileView from "@/views/ProfileView.vue";
import ToolsView from "@/views/ToolsView.vue";
import HelpView from "@/views/HelpView.vue";
import LoginView from "@/views/LoginView.vue";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import { cleanUrlFromLegacyHash } from "@/lib/appUrl";

const legacyTarget = cleanUrlFromLegacyHash(
  window.location,
  import.meta.env.BASE_URL,
);
if (legacyTarget) window.history.replaceState(null, "", legacyTarget);

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginView,
    meta: { public: true },
  },
  { path: "/", redirect: "/dashboard" },
  { path: "/dashboard", name: "dashboard", component: DashboardView },
  { path: "/view", name: "view", component: ViewLinksView },
  { path: "/edit", name: "edit", component: EditLinksView },
  { path: "/profile", name: "profile", component: ProfileView },
  { path: "/tools", name: "tools", component: ToolsView },
  // Open to everyone; inside the app when you're signed in
  {
    path: "/help",
    name: "help",
    component: HelpView,
    meta: { public: true, shellWhenSignedIn: true },
  },
  // Catch-all: redirect unknown routes to dashboard with a toast notification
  { path: "/:pathMatch(.*)*", name: "not-found", redirect: "/dashboard" },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to, from) => {
  const authStore = useAuthStore();

  // Always bootstrap auth so we know the real auth state
  if (!authStore.ready) {
    await authStore.bootstrap();
  }

  // Show a toast when landing on the catch-all not-found route
  if (to.name === "not-found") {
    const toastStore = useToastStore();
    toastStore.error("Page not found — redirecting to dashboard");
  }

  // Allow access to public routes
  if (to.meta.public) {
    // If authenticated user visits login, save share code and redirect away
    if (authStore.isAuthenticated && to.name === "login") {
      if (to.query.share) {
        sessionStorage.setItem("hiddenshelf_pending_share", to.query.share);
      }
      const returnTo =
        sessionStorage.getItem("hiddenshelf_return_to") || "/dashboard";
      sessionStorage.removeItem("hiddenshelf_return_to");
      return returnTo;
    }
    return true;
  }

  if (!authStore.isAuthenticated) {
    sessionStorage.setItem("hiddenshelf_return_to", to.fullPath);
    return { name: "login" };
  }

  return true;
});

export default router;
