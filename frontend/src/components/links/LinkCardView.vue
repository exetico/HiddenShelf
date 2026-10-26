<script setup>
import { computed } from "vue";
import { useAppStore } from "@/stores/app";
import { useLinkPreviewStore } from "@/stores/linkPreview";
import { useLinkDrag } from "@/composables/useLinkDrag";
import { usePublicShareStore } from "@/stores/publicShare";

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

const emit = defineEmits(["contextAction", "details", "reorder"]);

const appStore = useAppStore();
const preview = useLinkPreviewStore();
const drag = useLinkDrag();
const publicShare = usePublicShareStore();

// Hover card with the description, from the note icon, on devices that
// can hover
const canHover =
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover)").matches;

function onNoteEnter(event) {
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
        <i
          v-if="link.is_favorite"
          class="mdi mdi-star text-amber-500 text-xs align-middle"
          title="Favorite"
          data-testid="favorite-mark"
        ></i>
        {{ link.title }}
        <button
          v-if="link.description"
          type="button"
          class="ml-0.5 align-middle text-gray-400 hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-300"
          title="Show the description and details"
          :aria-label="`Details for ${link.title}`"
          data-testid="note-icon"
          @mouseenter="onNoteEnter"
          @mouseleave="preview.hoverEnd()"
          @click.stop.prevent="preview.hide(), emit('details', link)"
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
      <!-- Public links: a quiet globe, shown on hover (desktop), that opens
           the link to copy and its QR code. On phones: the long-press sheet. -->
      <button
        v-if="link.is_public"
        type="button"
        class="hidden md:inline-flex items-center gap-0.5 px-1.5 rounded-full border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/60 text-xs shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        title="Public link: copy it or show a QR code"
        aria-label="Share the public link"
        data-testid="public-copy"
        @click.stop.prevent="publicShare.open(link)"
      >
        <i class="mdi mdi-earth" aria-hidden="true"></i>
        <i class="mdi mdi-qrcode" aria-hidden="true"></i>
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
