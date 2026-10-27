<script setup>
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import AppShell from "@/components/layout/AppShell.vue";
import ToastList from "@/components/feedback/ToastList.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import ContextMenuPopover from "@/components/common/ContextMenuPopover.vue";
import PublicLinkDialog from "@/components/links/PublicLinkDialog.vue";
import LinkEditorHost from "@/components/links/LinkEditorHost.vue";
import { usesAppShell } from "@/lib/routeShell";

const route = useRoute();
const authStore = useAuthStore();
const appStore = useAppStore();

const isPublicRoute = computed(
  () => !usesAppShell(route.meta, authStore.isAuthenticated),
);

onMounted(async () => {
  await authStore.bootstrap();
  if (authStore.isAuthenticated) {
    await appStore.bootstrap();
  }
});
</script>

<template>
  <AppShell v-if="!isPublicRoute">
    <router-view />
  </AppShell>
  <router-view v-else />
  <ContextMenuPopover />
  <PublicLinkDialog />
  <LinkEditorHost v-if="!isPublicRoute" />
  <ConfirmDialog />
  <ToastList />
</template>
