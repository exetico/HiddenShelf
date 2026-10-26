<script setup>
import { ref, computed, watch } from "vue";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import LinkCardView from "@/components/links/LinkCardView.vue";
import CategoryFilterBar from "@/components/categories/CategoryFilterBar.vue";
import CategoryPicker from "@/components/categories/CategoryPicker.vue";
import ActiveTagFilter from "@/components/tags/ActiveTagFilter.vue";
import { useLinkMenu } from "@/composables/useLinkMenu";
import { appUrl } from "@/lib/appUrl";

const appStore = useAppStore();
const toastStore = useToastStore();

const linkMenu = useLinkMenu();

// Collapse state
const collapsedCategories = ref({});

watch(
  () => [appStore.search, appStore.filterCategory, appStore.filterTag],
  async () => {
    await appStore.loadLinks({ reset: true });
  },
);

const groupedCategories = computed(() => {
  const result = [];

  const uncategorized = appStore.linksByCategory.get("uncategorized") || [];
  if (!appStore.filterCategory || appStore.filterCategory === "uncategorized") {
    if (uncategorized.length) {
      result.push({
        key: "uncategorized",
        name: "Uncategorized",
        icon: "mdi-folder-outline",
        color: null,
        links: uncategorized,
      });
    }
  }

  for (const category of [
    ...appStore.categories,
    ...appStore.sharedCategories,
  ]) {
    const links = appStore.linksByCategory.get(category.id) || [];
    if (!links.length) continue;
    if (
      appStore.filterCategory &&
      String(appStore.filterCategory) !== String(category.id)
    )
      continue;
    result.push({
      key: category.id,
      name: category.name,
      icon: category.icon || "mdi-folder",
      color: category.color || "#6B7280",
      owner: category.owner_email || null,
      links,
    });
  }

  return result;
});

async function copyPublic(hash) {
  await navigator.clipboard.writeText(appUrl(`/h/${hash}`));
  toastStore.success("Public URL copied");
}

function handleContextAction({ link, event, action }) {
  if (action === "moveUp") {
    appStore.moveLink(link, "up");
    return;
  }
  if (action === "moveDown") {
    appStore.moveLink(link, "down");
    return;
  }
  // Right-click / long press
  linkMenu.open(event, link);
}

function toggleFilter(id) {
  appStore.filterCategory =
    String(appStore.filterCategory) === String(id) ? "" : String(id);
}

function toggleCategory(key) {
  collapsedCategories.value[key] = !collapsedCategories.value[key];
}
</script>

<template>
  <section class="space-y-3 sm:space-y-4">
    <!-- Category Filter Bar (sm+; on mobile the picker sits beside search) -->
    <CategoryFilterBar class="hidden sm:block" />

    <!-- Search bar -->
    <div
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-2 sm:p-3 flex gap-2"
    >
      <CategoryPicker />
      <input
        v-model="appStore.search"
        type="search"
        placeholder="Search links..."
        class="flex-1 min-w-0 px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      />
    </div>

    <!-- Favorite categories as quick chips (mobile) -->
    <div
      v-if="appStore.favoriteCategories.length"
      class="sm:hidden flex gap-1.5 overflow-x-auto scrollbar-hide -mt-1"
    >
      <button
        :title="`Show links in ${category.name}`"
        v-for="category in appStore.favoriteCategories"
        :key="category.id"
        class="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap shrink-0"
        :class="
          String(appStore.filterCategory) === String(category.id)
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 dark:bg-brand-800 text-gray-700 dark:text-brand-300'
        "
        @click="toggleFilter(category.id)"
      >
        <i
          :class="category.icon || 'mdi-folder'"
          class="mdi"
          :style="
            String(appStore.filterCategory) === String(category.id)
              ? ''
              : `color: ${category.color || '#6B7280'}`
          "
        ></i>
        {{ category.name }}
      </button>
    </div>

    <ActiveTagFilter />

    <!-- Pagination info -->
    <p
      v-if="appStore.total > 0"
      class="text-xs sm:text-sm text-gray-500 dark:text-brand-400"
    >
      Showing {{ appStore.links.length }} of {{ appStore.total }} links
    </p>

    <section v-if="groupedCategories.length" class="space-y-3 sm:space-y-6">
      <article v-for="group in groupedCategories" :key="group.key">
        <button
          :title="collapsedCategories[group.key] ? 'Expand' : 'Collapse'"
          class="flex items-center gap-2 mb-1 sm:mb-2 w-full text-left group"
          @click="toggleCategory(group.key)"
        >
          <i
            class="mdi transition-transform text-sm text-gray-400 dark:text-brand-500"
            :class="
              collapsedCategories[group.key]
                ? 'mdi-chevron-right'
                : 'mdi-chevron-down'
            "
          ></i>
          <i
            :class="group.icon"
            class="mdi text-base sm:text-lg"
            :style="group.color ? `color: ${group.color}` : ''"
          ></i>
          <h2 class="text-base sm:text-xl font-semibold">{{ group.name }}</h2>
          <span
            v-if="group.owner"
            class="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          >
            shared by {{ group.owner }}
          </span>
          <span class="text-sm text-gray-500 dark:text-brand-400"
            >({{ group.links.length }})</span
          >
        </button>
        <transition
          enter-active-class="transition-all duration-200 ease-out overflow-hidden"
          leave-active-class="transition-all duration-200 ease-in overflow-hidden"
          enter-from-class="max-h-0 opacity-0"
          enter-to-class="max-h-[2000px] opacity-100"
          leave-from-class="max-h-[2000px] opacity-100"
          leave-to-class="max-h-0 opacity-0"
        >
          <div
            v-show="!collapsedCategories[group.key]"
            class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-1 sm:p-2 sm:space-y-1"
          >
            <LinkCardView
              v-for="link in group.links"
              :key="link.id"
              :link="link"
              @copy-public="copyPublic"
              @context-action="handleContextAction"
            />
          </div>
        </transition>
      </article>
    </section>

    <div v-else class="py-10 text-center text-gray-500 dark:text-brand-400">
      <i class="mdi mdi-link-off text-6xl block mb-2"></i>
      No links found.
    </div>

    <div v-if="appStore.hasMore" class="text-center">
      <button
        title="Load more links"
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="appStore.loadMore()"
      >
        Load more
      </button>
    </div>
  </section>
</template>
