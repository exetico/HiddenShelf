<script setup>
import { ref, computed } from "vue";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();

// Drag-to-scroll state
const scrollContainer = ref(null);
const isDragging = ref(false);
const hasDragged = ref(false);
let dragStartX = 0;
let dragScrollLeft = 0;

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
    class="bg-white dark:bg-brand-900 rounded-lg shadow-sm p-3 transition-colors"
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
        :class="
          appStore.filterCategory === ''
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 dark:bg-brand-800 text-gray-700 dark:text-brand-300 hover:bg-gray-200 dark:hover:bg-brand-700'
        "
        class="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        @click="selectCategory('')"
      >
        <i class="mdi mdi-view-grid text-lg"></i>
        <span class="text-sm font-medium">All</span>
        <span class="text-xs opacity-75">({{ appStore.total }})</span>
      </button>

      <!-- Uncategorized Button -->
      <button
        v-if="uncategorizedCount > 0"
        :class="
          appStore.filterCategory === 'uncategorized'
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 dark:bg-brand-800 text-gray-700 dark:text-brand-300 hover:bg-gray-200 dark:hover:bg-brand-700'
        "
        class="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        @click="selectCategory('uncategorized')"
      >
        <i class="mdi mdi-folder-outline text-lg text-brand-400"></i>
        <span class="text-sm font-medium">Uncategorized</span>
        <span class="text-xs opacity-75">({{ uncategorizedCount }})</span>
      </button>

      <!-- Own Category Buttons -->
      <button
        v-for="category in appStore.categories"
        :key="category.id"
        :class="
          String(appStore.filterCategory) === String(category.id)
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 dark:bg-brand-800 text-gray-700 dark:text-brand-300 hover:bg-gray-200 dark:hover:bg-brand-700'
        "
        class="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        @click="selectCategory(String(category.id))"
      >
        <i
          :class="category.icon || 'mdi-folder'"
          class="mdi text-lg"
          :style="
            String(appStore.filterCategory) === String(category.id)
              ? ''
              : `color: ${category.color || '#6B7280'}`
          "
        ></i>
        <span class="text-sm font-medium">{{ category.name }}</span>
        <span class="text-xs opacity-75">({{ category.link_count || 0 }})</span>
      </button>

      <!-- Shared Category Buttons -->
      <button
        v-for="category in appStore.sharedCategories"
        :key="'shared-' + category.id"
        :class="
          String(appStore.filterCategory) === String(category.id)
            ? 'bg-blue-600 text-white'
            : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
        "
        class="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        :title="`Shared by ${category.owner_email}`"
        @click="selectCategory(String(category.id))"
      >
        <i
          :class="category.icon || 'mdi-folder'"
          class="mdi text-lg"
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
