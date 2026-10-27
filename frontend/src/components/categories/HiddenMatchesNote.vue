<script setup>
import { useAppStore } from "@/stores/app";

// Under a search or tag filter: matches in hidden categories are left
// out, and this offers them on demand
const appStore = useAppStore();
</script>

<template>
  <div
    v-if="appStore.hiddenMatches > 0 || appStore.showHidden"
    data-testid="hidden-matches"
    role="status"
    class="flex items-center justify-between gap-2 rounded-lg border border-dashed border-gray-300 dark:border-brand-700 px-3 py-2 text-sm text-gray-600 dark:text-brand-300"
  >
    <span class="flex items-center gap-2 min-w-0">
      <i class="mdi mdi-eye-off-outline text-lg" aria-hidden="true"></i>
      <span v-if="appStore.showHidden" class="truncate">Including hidden categories</span>
      <span v-else class="truncate"
        >{{ appStore.hiddenMatches }} more {{ appStore.hiddenMatches === 1 ? "match" : "matches" }}
        in hidden categories</span
      >
    </span>
    <button
      class="shrink-0 px-2.5 py-1 rounded-md border border-gray-300 dark:border-brand-700 text-xs font-medium hover:bg-gray-100 dark:hover:bg-brand-800"
      :title="appStore.showHidden ? 'Leave hidden categories out again' : 'Show the matches in hidden categories'"
      data-testid="toggle-hidden-matches"
      @click="appStore.revealHidden(!appStore.showHidden)"
    >
      {{ appStore.showHidden ? "Hide them" : "Show them" }}
    </button>
  </div>
</template>
