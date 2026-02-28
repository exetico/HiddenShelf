<script setup>
import { onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import AppShell from "@/components/layout/AppShell.vue";
import ToastList from "@/components/feedback/ToastList.vue";

const authStore = useAuthStore();
const appStore = useAppStore();

onMounted(async () => {
  await authStore.bootstrap();
  if (authStore.isAuthenticated) {
    await appStore.bootstrap();
  }
});
</script>

<template>
  <AppShell>
    <router-view />
  </AppShell>
  <ToastList />
</template>
