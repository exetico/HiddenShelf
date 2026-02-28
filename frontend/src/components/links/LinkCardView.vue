<script setup>
defineProps({
  link: {
    type: Object,
    required: true,
  },
});

defineEmits(["copyPublic"]);
</script>

<template>
  <a
    :href="link.url"
    target="_blank"
    class="block p-3 rounded-md hover:bg-gray-50 dark:hover:bg-brand-800 transition-colors"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="font-medium text-gray-900 dark:text-brand-100 truncate">
          {{ link.title }}
        </h3>
        <p class="text-xs text-gray-500 dark:text-brand-400 truncate">
          {{ link.url }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="link.is_public"
          class="text-green-600 dark:text-green-400 text-xs"
          @click.prevent.stop="$emit('copyPublic', link.hash)"
        >
          Share
        </button>
      </div>
    </div>
    <div class="mt-2 flex flex-wrap gap-1">
      <span
        v-for="tag in (link.tags || []).slice(0, 4)"
        :key="tag.id"
        class="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-brand-800 text-gray-600 dark:text-brand-300"
      >
        {{ tag.name }}
      </span>
    </div>
  </a>
</template>
