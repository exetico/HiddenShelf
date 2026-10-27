<script setup>
import { computed } from "vue";
import { useAppStore, SORT_OPTIONS } from "@/stores/app";

// Sort for the link lists, beside the "Showing X of Y" line
const appStore = useAppStore();
const sort = computed({
  get: () => appStore.sort,
  set: (value) => appStore.setSort(value),
});
</script>

<template>
  <label class="relative inline-flex items-center text-xs sm:text-sm text-gray-600 dark:text-brand-300">
    <i class="mdi mdi-sort pointer-events-none absolute left-2 text-base leading-none" aria-hidden="true"></i>
    <span class="sr-only">Sort links</span>
    <select
      v-model="sort"
      data-testid="sort-select"
      title="Sort the links"
      class="appearance-none pl-7 pr-7 py-1 rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-900 hover:bg-gray-100 dark:hover:bg-brand-800"
    >
      <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <i class="mdi mdi-chevron-down pointer-events-none absolute right-1.5 text-base leading-none" aria-hidden="true"></i>
  </label>
</template>
