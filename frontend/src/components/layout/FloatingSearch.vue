<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import SearchField from "@/components/common/SearchField.vue";

// Phones only, and only when turned on in Settings: a search box that
// floats at the bottom of every page. Typing on a page without a list
// jumps to View with the results, like the search in the desktop top bar.
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const searchText = computed({
  get: () => appStore.search,
  set: (value) => {
    appStore.search = value;
    if (value && route.name !== "view" && route.name !== "edit") router.push({ name: "view" });
  },
});
</script>

<template>
  <div
    class="md:hidden fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
    data-testid="floating-search"
  >
    <div
      class="pointer-events-auto mx-auto max-w-xl p-1.5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-brand-900/70 backdrop-blur-xl backdrop-saturate-150 shadow-lg shadow-black/10 dark:shadow-black/40"
    >
      <SearchField
        v-model="searchText"
        placeholder="Search links..."
        class="h-10 rounded-xl!"
        title="Search titles, descriptions, URLs and tags"
        data-testid="floating-search-input"
      />
    </div>
  </div>
</template>
