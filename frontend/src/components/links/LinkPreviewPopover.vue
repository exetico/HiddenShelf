<script setup>
import { computed } from "vue";
import { useLinkPreviewStore } from "@/stores/linkPreview";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/date";

// Desktop hover card with a link's description; see stores/linkPreview.js
const preview = useLinkPreviewStore();

const WIDTH = 360;
const MAX_HEIGHT = 288; // max-h-72
const GAP = 8;

// Beside the note icon (right, or left when there's no room), so the
// links above and below stay visible. Kept on screen vertically.
const style = computed(() => {
  const rect = preview.rect;
  if (!rect) return {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.right + GAP;
  if (left + WIDTH > vw - GAP) left = rect.left - WIDTH - GAP;
  if (left < GAP) {
    // Narrow window: fall back to just below the icon
    left = Math.max(GAP, Math.min(rect.left, vw - WIDTH - GAP));
    return { left: `${left}px`, top: `${rect.bottom + 4}px`, width: `${WIDTH}px` };
  }
  const top = Math.max(GAP, Math.min(rect.top - GAP, vh - MAX_HEIGHT - GAP));
  return { left: `${left}px`, top: `${top}px`, width: `${WIDTH}px` };
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
      <p
        v-if="preview.link.created_at"
        class="mt-2 text-xs text-gray-400 dark:text-brand-500"
      >
        Added {{ formatDate(preview.link.created_at) }}
      </p>
    </div>
  </Teleport>
</template>
