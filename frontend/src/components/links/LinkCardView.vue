<script setup>
import { computed } from "vue";
import { useAppStore } from "@/stores/app";

const props = defineProps({
  link: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["copyPublic", "contextAction"]);

const appStore = useAppStore();

const iconColor = computed(() => {
  if (!props.link.category_id) return "#3B82F6";
  const cat = appStore.categories.find((c) => c.id === props.link.category_id);
  return cat?.color || "#3B82F6";
});

function onContextMenu(event) {
  event.preventDefault();
  emit("contextAction", { link: props.link, event });
}
</script>

<template>
  <a
    :href="link.url"
    target="_blank"
    class="group hover:bg-gray-50 dark:hover:bg-brand-800 p-2 rounded-md transition-colors flex flex-wrap items-center gap-2 cursor-pointer block no-underline relative"
    @contextmenu="onContextMenu"
  >
    <i
      :class="link.icon || 'mdi-link-variant'"
      class="mdi text-lg flex-shrink-0"
      :style="`color: ${iconColor}`"
    ></i>
    <div class="flex-1 min-w-0 sm:min-w-[200px]">
      <div
        class="font-medium text-gray-900 dark:text-brand-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 text-sm"
      >
        {{ link.title }}
      </div>
      <p class="text-xs text-gray-500 dark:text-brand-400 truncate">
        {{ link.url }}
      </p>
    </div>
    <div class="flex items-center gap-2 ml-auto">
      <div class="flex flex-wrap gap-1 justify-end">
        <span
          v-for="tag in (link.tags || []).slice(0, 3)"
          :key="tag.id"
          class="px-2 py-0.5 bg-gray-100 dark:bg-brand-800 text-gray-600 dark:text-brand-300 text-xs rounded-full"
        >
          {{ tag.name }}
        </span>
        <span
          v-if="(link.tags || []).length > 3"
          class="px-2 py-0.5 text-brand-400 text-xs"
        >
          +{{ link.tags.length - 3 }}
        </span>
      </div>
      <button
        v-if="link.is_public"
        class="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm flex-shrink-0"
        title="Copy public link"
        @click.stop.prevent="$emit('copyPublic', link.hash)"
      >
        <i class="mdi mdi-link-variant"></i>
      </button>
      <!-- Reorder arrows (desktop only) -->
      <div
        class="hidden md:flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          class="text-brand-400 hover:text-gray-600 dark:hover:text-brand-300 text-xs leading-none"
          title="Move up"
          @click.stop.prevent="
            $emit('contextAction', { link, action: 'moveUp' })
          "
        >
          <i class="mdi mdi-chevron-up"></i>
        </button>
        <button
          class="text-brand-400 hover:text-gray-600 dark:hover:text-brand-300 text-xs leading-none"
          title="Move down"
          @click.stop.prevent="
            $emit('contextAction', { link, action: 'moveDown' })
          "
        >
          <i class="mdi mdi-chevron-down"></i>
        </button>
      </div>
    </div>
  </a>
</template>
