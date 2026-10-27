<script setup>
import { ref, computed } from "vue";
import { useAppStore } from "@/stores/app";
import { useContextMenuStore } from "@/stores/contextMenu";

const appStore = useAppStore();
const menu = useContextMenuStore();

// Right-click on a category
function openCategoryMenu(event, category) {
  const index = appStore.categories.findIndex((c) => c.id === category.id);
  const active = String(appStore.filterCategory) === String(category.id);
  menu.show(event, {
    title: category.name,
    items: [
      {
        label: active ? "Show all links" : "Show its links",
        icon: active ? "mdi-view-grid" : "mdi-filter-outline",
        action: () => {
          appStore.filterCategory = active ? "" : String(category.id);
        },
      },
      {
        label: category.is_favorite ? "Remove from favorites" : "Add to favorites",
        icon: category.is_favorite ? "mdi-star-off-outline" : "mdi-star-outline",
        // A deliberate menu choice, so no extra "are you sure?"
        action: () => appStore.toggleFavorite(category),
      },
      { divider: true },
      {
        label: "Move earlier",
        icon: "mdi-arrow-left",
        hidden: index <= 0,
        action: () => appStore.moveCategory(category, "up"),
      },
      {
        label: "Move later",
        icon: "mdi-arrow-right",
        hidden: index < 0 || index >= appStore.categories.length - 1,
        action: () => appStore.moveCategory(category, "down"),
      },
    ],
  });
}

// Drag-to-scroll state
const scrollContainer = ref(null);
const isDragging = ref(false);
const hasDragged = ref(false);
let dragStartX = 0;
let dragScrollLeft = 0;

// Favorites first, then the rest, each in the user's own order
const orderedCategories = computed(() => [
  ...appStore.categories.filter((c) => c.is_favorite),
  ...appStore.categories.filter((c) => !c.is_favorite),
]);

const uncategorizedCount = computed(() => {
  return (appStore.linksByCategory.get("uncategorized") || []).length;
});

function selectCategory(id) {
  if (hasDragged.value) return;
  appStore.filterCategory = id === appStore.filterCategory ? "" : id;
}

function startDrag(event) {
  if (!scrollContainer.value) return;
  isDragging.value = true;
  hasDragged.value = false;
  dragStartX = event.pageX - scrollContainer.value.offsetLeft;
  dragScrollLeft = scrollContainer.value.scrollLeft;
}

function drag(event) {
  if (!isDragging.value || !scrollContainer.value) return;
  event.preventDefault();
  const x = event.pageX - scrollContainer.value.offsetLeft;
  const walk = (x - dragStartX) * 2;
  if (Math.abs(walk) > 3) {
    hasDragged.value = true;
  }
  scrollContainer.value.scrollLeft = dragScrollLeft - walk;
}

function stopDrag() {
  isDragging.value = false;
  setTimeout(() => {
    hasDragged.value = false;
  }, 50);
}
</script>

<template>
  <div
    data-testid="category-filter-bar"
    class="bg-white dark:bg-brand-900 rounded-lg shadow-xs p-2 sm:p-3 transition-colors"
  >
    <div
      ref="scrollContainer"
      class="flex items-center gap-2 overflow-x-auto scrollbar-hide drag-scroll"
      @mousedown="startDrag"
      @mousemove="drag"
      @mouseup="stopDrag"
      @mouseleave="stopDrag"
    >
      <!-- All Categories Button -->
      <button
        title="Show links from all categories"
        :class="
          appStore.filterCategory === ''
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 dark:bg-brand-800 text-gray-700 dark:text-brand-300 hover:bg-gray-200 dark:hover:bg-brand-700'
        "
        class="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors whitespace-nowrap shrink-0"
        @click="selectCategory('')"
      >
        <i class="mdi mdi-view-grid text-base sm:text-lg"></i>
        <span class="text-sm font-medium">All</span>
        <span class="text-xs opacity-75">({{ appStore.total }})</span>
      </button>

      <!-- Uncategorized Button -->
      <button
        title="Show links without a category"
        v-if="uncategorizedCount > 0"
        :class="
          appStore.filterCategory === 'uncategorized'
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 dark:bg-brand-800 text-gray-700 dark:text-brand-300 hover:bg-gray-200 dark:hover:bg-brand-700'
        "
        class="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors whitespace-nowrap shrink-0"
        @click="selectCategory('uncategorized')"
      >
        <i class="mdi mdi-folder-outline text-base sm:text-lg text-brand-400"></i>
        <span class="text-sm font-medium">Uncategorized</span>
        <span class="text-xs opacity-75">({{ uncategorizedCount }})</span>
      </button>

      <!-- Own Category Buttons. A small star sits in the corner (inside the
           padding, so the button is no wider): always shown for favorites,
           on hover for the rest. -->
      <div
        v-for="category in orderedCategories"
        :key="category.id"
        :class="
          String(appStore.filterCategory) === String(category.id)
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 dark:bg-brand-800 text-gray-700 dark:text-brand-300 hover:bg-gray-200 dark:hover:bg-brand-700'
        "
        class="group relative flex items-center rounded-lg transition-colors whitespace-nowrap shrink-0"
        @contextmenu="openCategoryMenu($event, category)"
      >
        <button
          :title="`Show links in ${category.name}`"
          class="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2"
          @click="selectCategory(String(category.id))"
        >
          <i
            :class="category.icon || 'mdi-folder'"
            class="mdi text-base sm:text-lg"
            :style="
              String(appStore.filterCategory) === String(category.id)
                ? ''
                : `color: ${category.color || '#6B7280'}`
            "
          ></i>
          <span class="text-sm font-medium">{{ category.name }}</span>
          <span class="text-xs opacity-75"
            >({{ category.link_count || 0 }})</span
          >
        </button>
        <button
          class="absolute top-0 right-0 p-0.5 leading-none transition-opacity"
          :class="
            category.is_favorite
              ? 'text-amber-500'
              : 'opacity-0 group-hover:opacity-70 hover:opacity-100! focus:opacity-100'
          "
          :title="
            category.is_favorite ? 'Remove from favorites' : 'Add to favorites'
          "
          :aria-label="
            category.is_favorite
              ? `Remove ${category.name} from favorites`
              : `Add ${category.name} to favorites`
          "
          @click="!hasDragged && appStore.confirmToggleFavorite(category)"
        >
          <i
            class="mdi text-[11px]"
            :class="category.is_favorite ? 'mdi-star' : 'mdi-star-outline'"
          ></i>
        </button>
      </div>

      <!-- Shared Category Buttons -->
      <button
        v-for="category in appStore.sharedCategories"
        :key="'shared-' + category.id"
        :class="
          String(appStore.filterCategory) === String(category.id)
            ? 'bg-brand-600 text-white'
            : 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50'
        "
        class="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors whitespace-nowrap shrink-0"
        :title="`Shared by ${category.owner_email}`"
        @click="selectCategory(String(category.id))"
      >
        <i
          :class="category.icon || 'mdi-folder'"
          class="mdi text-base sm:text-lg"
          :style="
            String(appStore.filterCategory) === String(category.id)
              ? ''
              : `color: ${category.color || '#6B7280'}`
          "
        ></i>
        <span class="text-sm font-medium">{{ category.name }}</span>
        <i class="mdi mdi-account-group text-xs opacity-75"></i>
        <span class="text-xs opacity-75">({{ category.link_count || 0 }})</span>
      </button>
    </div>
  </div>
</template>
