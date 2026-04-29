<script setup>
import { computed } from "vue";
import { useAppStore } from "@/stores/app";

const props = defineProps({
  link: {
    type: Object,
    required: true,
  },
});

defineEmits(["edit", "delete", "copyPublic"]);

const appStore = useAppStore();

const iconColor = computed(() => {
  if (!props.link.category_id) return "#3B82F6";
  const cat = appStore.categories.find((c) => c.id === props.link.category_id);
  return cat?.color || "#3B82F6";
});
</script>

<template>
  <article
    class="bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 rounded-lg p-4"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2 min-w-0">
        <i
          :class="link.icon || 'mdi-link-variant'"
          class="mdi text-lg mt-0.5 flex-shrink-0"
          :style="`color: ${iconColor}`"
        ></i>
        <div class="min-w-0">
          <h3 class="font-semibold text-gray-900 dark:text-white truncate">
            {{ link.title }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-brand-400 truncate">
            {{ link.url }}
          </p>
        </div>
      </div>
      <div class="flex gap-2 text-sm">
        <button
          class="text-brand-600 dark:text-brand-400"
          @click="$emit('edit', link)"
        >
          Edit
        </button>
        <button
          class="text-red-600 dark:text-red-400"
          @click="$emit('delete', link.id)"
        >
          Delete
        </button>
      </div>
    </div>

    <p class="mt-2 text-sm text-gray-600 dark:text-brand-300">
      {{ link.description || "No description" }}
    </p>

    <div class="mt-3 flex items-center justify-between">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="tag in (link.tags || []).slice(0, 3)"
          :key="tag.id"
          class="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-brand-800 text-gray-600 dark:text-brand-300"
          >{{ tag.name }}</span
        >
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <!-- Direct redirect indicator -->
        <span
          v-if="link.direct_redirect"
          class="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
          title="Direct redirect enabled"
        >
          <i class="mdi mdi-lightning-bolt"></i> redirect
        </span>
        <!-- Visit count for public links -->
        <span
          v-if="link.is_public && link.total_visits > 0"
          class="text-xs text-gray-400 dark:text-brand-500"
          title="Total visits"
        >
          <i class="mdi mdi-eye-outline"></i> {{ link.total_visits }}
        </span>
        <span
          class="text-xs text-gray-400 dark:text-brand-500"
          :title="link.is_public ? 'Public link' : 'Private link'"
        >
          {{ link.is_public ? "🔓" : "🔒" }}
        </span>
        <button
          v-if="link.is_public"
          class="text-xs text-green-600 dark:text-green-400"
          @click="$emit('copyPublic', link.hash)"
        >
          Copy public URL
        </button>
      </div>
    </div>
  </article>
</template>
