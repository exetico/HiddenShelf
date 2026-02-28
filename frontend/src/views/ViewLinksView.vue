<script setup>
import { computed, watch } from "vue";
import { useAppStore } from "@/stores/app";
import LinkCardView from "@/components/links/LinkCardView.vue";
import { useToastStore } from "@/stores/toast";

const appStore = useAppStore();
const toastStore = useToastStore();

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
</script>

<template>
  <section class="space-y-4">
    <div
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-3 flex flex-col sm:flex-row gap-2"
    >
      <input
        v-model="appStore.search"
        type="search"
        placeholder="Search links..."
        class="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      />
      <select
        v-model="appStore.filterCategory"
        class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      >
        <option value="">All categories</option>
        <option value="uncategorized">Uncategorized</option>
        <option
          v-for="category in appStore.categories"
          :key="category.id"
          :value="String(category.id)"
        >
          {{ category.name }}
        </option>
        <option
          v-for="category in appStore.sharedCategories"
          :key="`shared-${category.id}`"
          :value="String(category.id)"
        >
          {{ category.name }} (shared)
        </option>
      </select>
    </div>

    <section v-if="groupedCategories.length" class="space-y-6">
      <article v-for="group in groupedCategories" :key="group.key">
        <div class="flex items-center gap-2 mb-2">
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
  </section>
</template>
