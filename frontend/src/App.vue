<script setup>
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import AppShell from "@/components/layout/AppShell.vue";
import ToastList from "@/components/feedback/ToastList.vue";

const route = useRoute();
const authStore = useAuthStore();
const appStore = useAppStore();

const isPublicRoute = computed(() => route.meta?.public === true);

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
  <ToastList />
</template>
