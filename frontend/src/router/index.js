import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "@/views/DashboardView.vue";
import ViewLinksView from "@/views/ViewLinksView.vue";
import EditLinksView from "@/views/EditLinksView.vue";
import ProfileView from "@/views/ProfileView.vue";
import LoginView from "@/views/LoginView.vue";
import { useAuthStore } from "@/stores/auth";

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
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  // Always bootstrap auth so we know the real auth state
  if (!authStore.ready) {
    await authStore.bootstrap();
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
