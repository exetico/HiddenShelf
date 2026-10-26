<script setup>
import { computed } from "vue";
import { useAppStore } from "@/stores/app";
import { useLinkPreviewStore } from "@/stores/linkPreview";
import { useLinkDrag } from "@/composables/useLinkDrag";

const props = defineProps({
  link: {
    type: Object,
    required: true,
  },
  // Which category list the card is in; drops only land in the same one
  groupKey: {
    type: [String, Number],
    default: null,
  },
  // Show the drag handle (own links on desktop)
  reorderable: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["copyPublic", "contextAction", "details", "reorder"]);

const appStore = useAppStore();
const preview = useLinkPreviewStore();
const drag = useLinkDrag();

// Hover card with the description, on devices that can hover
const canHover =
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover)").matches;

function onMouseEnter(event) {
  if (canHover && !drag.state.draggingId) {
    preview.hoverStart(props.link, event.currentTarget);
  }
}

// Not armed by the grip: the browser's normal drag of the URL goes ahead
function onDragStart(event) {
  preview.hide();
  drag.start(event, props.link, props.groupKey);
}

function onDrop(event) {
  const result = drag.drop(event, props.link, props.groupKey);
  if (result) emit("reorder", { ...result, groupKey: props.groupKey });
}

const dropIndicator = computed(() =>
  drag.state.overId === props.link.id ? drag.state.overPosition : null,
);

const iconColor = computed(() => {
  if (!props.link.category_id) return "#3B82F6";
  const cat = appStore.categories.find((c) => c.id === props.link.category_id);
  return cat?.color || "#3B82F6";
});

function onContextMenu(event) {
  event.preventDefault();
  emit("contextAction", { link: props.link, event });
}

// A long press on a phone opens the details sheet (iOS never fires
// contextmenu, and the sheet has the menu's actions too)
const LONG_PRESS_MS = 500;
let pressTimer = null;
let longPressed = false;

function onTouchStart(event) {
  longPressed = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    longPressed = true;
    emit("details", props.link);
  }, LONG_PRESS_MS);
}

function cancelPress() {
  clearTimeout(pressTimer);
}

function onClick(event) {
  // Swallow the click that follows a long press so the link doesn't open
  if (longPressed) {
    event.preventDefault();
    longPressed = false;
  }
}
</script>

<template>
  <a
    :title="link.url"
    :href="link.url"
    target="_blank"
    class="group hover:bg-gray-50 dark:hover:bg-brand-800 px-1.5 py-1 sm:p-2 rounded-md transition-colors flex sm:flex-wrap items-center gap-2 cursor-pointer block no-underline relative max-sm:select-none"
    :class="{
      'opacity-40': drag.state.draggingId === link.id,
      'shadow-[inset_0_2px_0_0] shadow-brand-500': dropIndicator === 'before',
      'shadow-[inset_0_-2px_0_0] shadow-brand-500': dropIndicator === 'after',
    }"
    style="-webkit-touch-callout: none"
    :data-link-id="link.id"
    @contextmenu="onContextMenu"
    @mouseenter="onMouseEnter"
    @mouseleave="preview.hoverEnd()"
    @dragstart="onDragStart"
    @dragover="drag.over($event, link, groupKey)"
    @dragleave="drag.leave(link)"
    @drop="onDrop"
    @dragend="drag.end()"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="cancelPress"
    @touchend="cancelPress"
    @touchcancel="cancelPress"
    @click="onClick"
  >
    <!-- Grip: the only place a reorder drag can start (desktop) -->
    <span
      v-if="reorderable"
      class="drag-handle hidden md:flex -ml-1 -mr-1 cursor-grab active:cursor-grabbing text-gray-300 dark:text-brand-600 opacity-0 group-hover:opacity-100 hover:text-brand-500 transition-opacity"
      title="Drag to change the order"
      aria-hidden="true"
      @mousedown="drag.arm(link)"
      @mouseup="drag.disarm()"
      @click.stop.prevent
    >
      <i class="mdi mdi-drag-vertical text-lg leading-none"></i>
    </span>
    <i
      :class="link.icon || 'mdi-link-variant'"
      class="mdi text-base sm:text-lg shrink-0"
      :style="`color: ${iconColor}`"
    ></i>
    <!-- Mobile: title and URL share one line; sm+: stacked -->
    <div
      class="flex-1 min-w-0 sm:min-w-[200px] flex items-baseline gap-2 sm:block"
    >
      <div
        class="font-medium text-gray-900 dark:text-brand-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 text-sm truncate shrink-0 max-w-[70%] sm:max-w-none sm:whitespace-normal sm:overflow-visible"
      >
        {{ link.title }}
        <button
          v-if="link.description"
          type="button"
          class="ml-0.5 align-middle text-gray-400 hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-300"
          title="Show the description and details"
          :aria-label="`Details for ${link.title}`"
          @click.stop.prevent="emit('details', link)"
        >
          <i class="mdi mdi-text-box-outline text-sm leading-none"></i>
        </button>
      </div>
      <p
        class="text-xs text-gray-500 dark:text-brand-400 truncate min-w-0 flex-1"
      >
        {{ link.url }}
      </p>
    </div>
    <div class="flex items-center gap-2 ml-auto shrink-0">
      <div class="hidden sm:flex flex-wrap gap-1 justify-end">
        <button
          v-for="tag in (link.tags || []).slice(0, 3)"
          :key="tag.id"
          class="px-2 py-0.5 bg-gray-100 dark:bg-brand-800 text-gray-600 dark:text-brand-300 hover:bg-brand-600 hover:text-white text-xs rounded-full"
          :title="`Show links tagged ${tag.name}`"
          @click.stop.prevent="appStore.filterByTag(tag.id)"
        >
          {{ tag.name }}
        </button>
        <span
          v-if="(link.tags || []).length > 3"
          class="px-2 py-0.5 text-brand-400 text-xs"
        >
          +{{ link.tags.length - 3 }}
        </span>
      </div>
      <button
        v-if="link.is_public"
        class="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm shrink-0"
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
