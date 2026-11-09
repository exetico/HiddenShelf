<script setup>
import { computed } from "vue";
import { useAppStore } from "@/stores/app";

// One of your links in a tool's results: title, address and category,
// with the tool's buttons on the right (the default slot)
const props = defineProps({
  link: { type: Object, required: true },
  // Shown under the address, like "The page is gone (404)"
  note: { type: String, default: "" },
  noteTone: { type: String, default: "" },
});

const appStore = useAppStore();
const category = computed(
  () =>
    props.link.category_name ||
    appStore.categories.find((c) => c.id === props.link.category_id)?.name ||
    "",
);
</script>

<template>
  <li class="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5" data-testid="tool-link-row">
    <div class="min-w-0 flex-1">
      <p class="font-medium text-sm text-gray-900 dark:text-white truncate">
        <i v-if="link.icon" class="mdi mr-1" :class="link.icon" aria-hidden="true"></i>{{ link.title }}
      </p>
      <a
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="block text-xs font-mono text-gray-500 dark:text-brand-400 truncate hover:underline"
        :title="`Open ${link.url}`"
        >{{ link.url }}</a
      >
      <p class="text-xs text-gray-500 dark:text-brand-400 flex flex-wrap gap-x-2">
        <span v-if="category"><i class="mdi mdi-folder-outline" aria-hidden="true"></i> {{ category }}</span>
        <span v-if="link.created_at">Saved {{ String(link.created_at).slice(0, 10) }}</span>
        <span v-if="link.total_visits">{{ link.total_visits }} visits</span>
      </p>
      <p v-if="note" class="text-xs mt-0.5" :class="noteTone || 'text-gray-600 dark:text-brand-300'" data-testid="tool-link-note">
        {{ note }}
      </p>
    </div>
    <div class="flex flex-wrap gap-1.5 shrink-0">
      <slot />
    </div>
  </li>
</template>
