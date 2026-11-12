<script setup>
import { computed } from "vue";
import TopNav from "@/components/layout/TopNav.vue";
import FloatingSearch from "@/components/layout/FloatingSearch.vue";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
// Only a real true turns it on (Settings, off by default)
const floatingSearch = computed(() => appStore.settings?.floating_search === true);
</script>

<template>
  <div data-testid="app-shell" class="min-h-screen bg-gray-50 dark:bg-brand-950 transition-colors">
    <TopNav />
    <main
      data-testid="app-main"
      class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6"
      :class="floatingSearch && 'max-md:pb-24'"
    >
      <slot />
    </main>
    <FloatingSearch v-if="floatingSearch" />
  </div>
</template>
