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
import { connection, onReconnect } from "@/lib/connection";

const route = useRoute();
const authStore = useAuthStore();
const appStore = useAppStore();

const isPublicRoute = computed(
  () => !usesAppShell(route.meta, authStore.isAuthenticated),
);

// Until the server has said who you are, nothing opens. If it can't be
// reached (restarting after an update, say), say so instead of a blank page.
const waitingForServer = computed(() => !authStore.ready && connection.down);

// Load the shelf again once the server answers after being away, so
// whatever failed meanwhile fills in without a reload
onReconnect(() => {
  if (authStore.isAuthenticated) appStore.bootstrap().catch(() => {});
});

onMounted(async () => {
  await authStore.bootstrap();
  if (authStore.isAuthenticated) {
    // A server that can't be reached shows the connection notice, and the
    // shelf loads again when it is back (above)
    await appStore.bootstrap().catch(() => {});
  }
});
</script>

<template>
  <div
    v-if="waitingForServer"
    data-testid="waiting-for-server"
    class="min-h-screen flex items-center justify-center bg-gray-50 px-6 text-center dark:bg-brand-950"
  >
    <div class="max-w-sm space-y-2">
      <i class="mdi mdi-cloud-sync-outline text-4xl text-gray-400 dark:text-brand-400" aria-hidden="true"></i>
      <h1 class="text-lg font-semibold text-gray-800 dark:text-brand-100">Connecting to the server…</h1>
      <p class="text-sm text-gray-500 dark:text-brand-400">
        The server isn't answering right now. It may be restarting after an update.
        The page opens by itself as soon as it's back.
      </p>
    </div>
  </div>
  <AppShell v-else-if="!isPublicRoute">
    <router-view />
  </AppShell>
  <router-view v-else />
  <ContextMenuPopover />
  <PublicLinkDialog />
  <LinkEditorHost v-if="!isPublicRoute" />
  <ConfirmDialog />
  <ToastList />
</template>
