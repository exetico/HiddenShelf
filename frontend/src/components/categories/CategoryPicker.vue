<script setup>
import { ref, computed } from "vue";
import { useAppStore } from "@/stores/app";

// Mobile replacement for CategoryFilterBar: one compact button that opens
// a bottom sheet with every category, favorites first.
const appStore = useAppStore();
const open = ref(false);

const uncategorizedCount = computed(
  () => (appStore.linksByCategory.get("uncategorized") || []).length,
);

const otherCategories = computed(() =>
  appStore.categories.filter((c) => !c.is_favorite),
);

const current = computed(() => {
  const id = String(appStore.filterCategory);
  if (!id) return { name: "All", icon: "mdi-view-grid", color: null };
  if (id === "uncategorized")
    return { name: "Uncategorized", icon: "mdi-folder-outline", color: null };
  const cat = [...appStore.categories, ...appStore.sharedCategories].find(
    (c) => String(c.id) === id,
  );
  return cat
    ? { name: cat.name, icon: cat.icon || "mdi-folder", color: cat.color }
    : { name: "All", icon: "mdi-view-grid", color: null };
});

function select(id) {
  appStore.filterCategory = id;
  open.value = false;
}

function isActive(id) {
  return String(appStore.filterCategory) === String(id);
}

function rowClass(active) {
  return [
    "flex-1 w-full flex items-center gap-3 px-2 py-2.5 rounded-md text-left text-sm",
    active ? "bg-brand-600 text-white" : "",
  ];
}
</script>

<template>
  <button
    type="button"
    class="sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800 text-sm max-w-[45%] shrink-0"
    aria-haspopup="dialog"
    @click="open = true"
  >
    <i
      :class="current.icon"
      class="mdi text-base shrink-0"
      :style="current.color ? `color: ${current.color}` : ''"
    ></i>
    <span class="truncate">{{ current.name }}</span>
    <i class="mdi mdi-menu-down shrink-0 opacity-70"></i>
  </button>

  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[90] bg-black/50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Choose category"
      @click.self="open = false"
    >
      <div
        class="w-full max-h-[75dvh] overflow-y-auto bg-white dark:bg-brand-900 rounded-t-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div
          class="sticky top-0 bg-white dark:bg-brand-900 px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-200 dark:border-brand-800"
        >
          <h2 class="font-semibold">Categories</h2>
          <button
            class="p-1 text-gray-500 dark:text-brand-300"
            aria-label="Close"
            @click="open = false"
          >
            <i class="mdi mdi-close text-xl"></i>
          </button>
        </div>

        <ul class="p-2">
          <li>
            <button
              :class="rowClass(!appStore.filterCategory)"
              @click="select('')"
            >
              <i class="mdi mdi-view-grid text-lg"></i>
              <span class="flex-1 truncate">All</span>
              <span class="text-xs opacity-70">{{ appStore.total }}</span>
            </button>
          </li>
          <li v-if="uncategorizedCount > 0">
            <button
              :class="rowClass(isActive('uncategorized'))"
              @click="select('uncategorized')"
            >
              <i class="mdi mdi-folder-outline text-lg text-brand-400"></i>
              <span class="flex-1 truncate">Uncategorized</span>
              <span class="text-xs opacity-70">{{ uncategorizedCount }}</span>
            </button>
          </li>

          <template
            v-for="section in [
              { label: 'Favorites', items: appStore.favoriteCategories },
              { label: 'Categories', items: otherCategories },
            ]"
            :key="section.label"
          >
            <li
              v-if="section.items.length"
              class="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-brand-400"
            >
              {{ section.label }}
            </li>
            <li
              v-for="category in section.items"
              :key="category.id"
              class="flex items-center"
            >
              <button
                :class="rowClass(isActive(category.id))"
                @click="select(String(category.id))"
              >
                <i
                  :class="category.icon || 'mdi-folder'"
                  class="mdi text-lg"
                  :style="`color: ${category.color || '#6B7280'}`"
                ></i>
                <span class="flex-1 truncate">{{ category.name }}</span>
                <span class="text-xs opacity-70">{{
                  category.link_count || 0
                }}</span>
              </button>
              <button
                class="p-2 shrink-0"
                :class="
                  category.is_favorite
                    ? 'text-amber-500'
                    : 'text-gray-400 dark:text-brand-500'
                "
                :aria-label="
                  category.is_favorite
                    ? `Remove ${category.name} from favorites`
                    : `Add ${category.name} to favorites`
                "
                @click="appStore.toggleFavorite(category)"
              >
                <i
                  class="mdi text-lg"
                  :class="category.is_favorite ? 'mdi-star' : 'mdi-star-outline'"
                ></i>
              </button>
            </li>
          </template>

          <template v-if="appStore.sharedCategories.length">
            <li
              class="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-brand-400"
            >
              Shared with you
            </li>
            <li
              v-for="category in appStore.sharedCategories"
              :key="'shared-' + category.id"
            >
              <button
                :class="rowClass(isActive(category.id))"
                @click="select(String(category.id))"
              >
                <i
                  :class="category.icon || 'mdi-folder'"
                  class="mdi text-lg"
                  :style="`color: ${category.color || '#6B7280'}`"
                ></i>
                <span class="flex-1 truncate">{{ category.name }}</span>
                <i class="mdi mdi-account-group text-xs opacity-70"></i>
                <span class="text-xs opacity-70">{{
                  category.link_count || 0
                }}</span>
              </button>
            </li>
          </template>
        </ul>
        <p class="px-4 pb-1 text-xs text-gray-500 dark:text-brand-400">
          Star a category to pin it above your links. Change the order under
          Edit → Categories.
        </p>
      </div>
    </div>
  </Teleport>
</template>
