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
  <div
    v-if="appStore.filterTag"
    role="status"
    class="flex items-center justify-between gap-2 rounded-lg border-2 border-brand-500 bg-brand-100 dark:bg-brand-800/70 px-3 py-2 text-sm text-brand-900 dark:text-brand-100"
  >
    <span class="flex items-center gap-2 min-w-0">
      <i class="mdi mdi-filter-variant text-lg text-brand-600 dark:text-brand-300"></i>
      <span class="truncate"
        >Only links tagged
        <strong>#{{ tag?.name || "tag" }}</strong></span
      >
    </span>
    <button
      class="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium"
      title="Clear tag filter"
      @click="appStore.filterByTag('')"
    >
      <i class="mdi mdi-close"></i>
      Clear
    </button>
  </div>
</template>
