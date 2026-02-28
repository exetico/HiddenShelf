import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "@/views/DashboardView.vue";
import ViewLinksView from "@/views/ViewLinksView.vue";
import EditLinksView from "@/views/EditLinksView.vue";
import ProfileView from "@/views/ProfileView.vue";
import { useAuthStore } from "@/stores/auth";

const routes = [
  { path: "/", redirect: "/dashboard" },
  { path: "/dashboard", name: "dashboard", component: DashboardView },
  { path: "/view", name: "view", component: ViewLinksView },
  { path: "/edit", name: "edit", component: EditLinksView },
  { path: "/profile", name: "profile", component: ProfileView },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  if (!authStore.ready) {
    await authStore.bootstrap();
  }

  if (!authStore.isAuthenticated) {
    sessionStorage.setItem("hiddenshelf_return_to", `#${to.fullPath}`);
    window.location.href = "/public/login.html";
    return false;
  }

  return true;
});

export default router;
