<script setup>
import { computed } from "vue";
import { useAppStore } from "@/stores/app";

// Shows the tag the link list is filtered by, with a way to clear it
const appStore = useAppStore();

const tag = computed(() =>
  appStore.tags.find((t) => String(t.id) === String(appStore.filterTag)),
);
</script>

<template>
  <div v-if="appStore.filterTag" class="flex items-center gap-2 text-sm">
    <span class="text-gray-500 dark:text-brand-400">Tagged</span>
    <button
      class="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-600 text-white"
      title="Clear tag filter"
      @click="appStore.filterByTag('')"
    >
      #{{ tag?.name || "tag" }}
      <i class="mdi mdi-close text-xs"></i>
    </button>
  </div>
</template>
