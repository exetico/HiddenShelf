<script setup>
import { computed } from "vue";
import { useLinkPreviewStore } from "@/stores/linkPreview";
import { renderMarkdown } from "@/lib/markdown";

// Desktop hover card with a link's description; see stores/linkPreview.js
const preview = useLinkPreviewStore();

const WIDTH = 380;
const style = computed(() => {
  const rect = preview.rect;
  if (!rect) return {};
  const margin = 8;
  const left = Math.max(
    margin,
    Math.min(rect.left + 28, window.innerWidth - WIDTH - margin),
  );
  // Below the link, or above it when it sits near the bottom of the screen
  const below = rect.bottom + 220 < window.innerHeight;
  return below
    ? { left: `${left}px`, top: `${rect.bottom + 4}px`, width: `${WIDTH}px` }
    : {
        left: `${left}px`,
        bottom: `${window.innerHeight - rect.top + 4}px`,
        width: `${WIDTH}px`,
      };
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="preview.link"
      role="tooltip"
      class="fixed z-50 max-w-[calc(100vw-1rem)] max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-brand-700 bg-white dark:bg-brand-900 shadow-xl p-3 text-sm text-gray-700 dark:text-brand-200"
      :style="style"
      data-testid="link-preview"
      @mouseenter="preview.keep()"
      @mouseleave="preview.hoverEnd()"
    >
      <!-- renderMarkdown escapes all HTML, so v-html is safe here -->
      <div class="md-content" v-html="renderMarkdown(preview.link.description)"></div>
      <div
        v-if="preview.link.tags?.length"
        class="mt-2 flex flex-wrap gap-1"
      >
        <span
          v-for="tag in preview.link.tags"
          :key="tag.id"
          class="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-brand-800 text-gray-600 dark:text-brand-300"
          >#{{ tag.name }}</span
        >
      </div>
    </div>
  </Teleport>
</template>
