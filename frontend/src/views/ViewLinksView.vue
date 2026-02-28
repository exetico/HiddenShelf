<script setup>
import { ref, computed, watch } from "vue";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import LinkCardView from "@/components/links/LinkCardView.vue";
import CategoryFilterBar from "@/components/categories/CategoryFilterBar.vue";
import ContextMenu from "@/components/common/ContextMenu.vue";

const appStore = useAppStore();
const toastStore = useToastStore();

// Context menu state
const contextLink = ref(null);
const showContextMenu = ref(false);

watch(
  () => [appStore.search, appStore.filterCategory],
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
  const url = `${window.location.origin}/h/${hash}`;
  await navigator.clipboard.writeText(url);
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
  // Right-click context menu
  contextLink.value = link;
  showContextMenu.value = true;
}

function closeContextMenu() {
  showContextMenu.value = false;
  contextLink.value = null;
}
</script>

<template>
  <section class="space-y-4">
    <!-- Category Filter Bar -->
    <CategoryFilterBar />

    <!-- Search bar -->
    <div
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-3"
    >
      <input
        v-model="appStore.search"
        type="search"
        placeholder="Search links..."
        class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      />
    </div>

    <section v-if="groupedCategories.length" class="space-y-6">
      <article v-for="group in groupedCategories" :key="group.key">
        <div class="flex items-center gap-2 mb-2">
          <i
            :class="group.icon"
            class="mdi text-lg"
            :style="group.color ? `color: ${group.color}` : ''"
          ></i>
          <h2 class="text-xl font-semibold">{{ group.name }}</h2>
          <span
            v-if="group.owner"
            class="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          >
            shared by {{ group.owner }}
          </span>
          <span class="text-sm text-gray-500 dark:text-brand-400"
            >({{ group.links.length }})</span
          >
        </div>
        <div
          class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-2 space-y-1"
        >
          <LinkCardView
            v-for="link in group.links"
            :key="link.id"
            :link="link"
            @copy-public="copyPublic"
            @context-action="handleContextAction"
          />
        </div>
      </article>
    </section>

    <div v-else class="py-10 text-center text-gray-500 dark:text-brand-400">
      No links found.
    </div>

    <div v-if="appStore.hasMore" class="text-center">
      <button
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="appStore.loadMore()"
      >
        Load more
      </button>
    </div>

    <!-- Right-click context menu -->
    <ContextMenu
      :open="showContextMenu"
      :link="contextLink"
      @close="closeContextMenu"
    />
  </section>
</template>
