<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useTheme } from "@/composables/useTheme";

const appStore = useAppStore();
const router = useRouter();
const { isDark, toggleTheme } = useTheme();

const totalLinks = computed(() => appStore.total || appStore.links.length);

onMounted(() => {
  appStore.loadVisitStats();
});

// Tag cloud: bigger and bolder the more links use the tag. Tags on a
// single link are tucked behind "Show more" so the common ones stand out.
const showAllTags = ref(false);
const allTags = computed(() => {
  const max = Math.max(1, ...appStore.tags.map((t) => t.usage_count || 0));
  return appStore.tags.map((tag) => {
    const weight = (tag.usage_count || 0) / max;
    return {
      ...tag,
      sizeClass:
        weight > 0.66
          ? "text-base font-semibold"
          : weight > 0.33
            ? "text-sm font-medium"
            : "text-xs",
    };
  });
});

const commonTags = computed(() =>
  allTags.value.filter((t) => (t.usage_count || 0) > 1),
);
// If every tag is single-use, hiding them all would leave nothing to show
const tagCloud = computed(() =>
  showAllTags.value || !commonTags.value.length ? allTags.value : commonTags.value,
);
const hiddenTagCount = computed(
  () => allTags.value.length - commonTags.value.length,
);

// Top tiles. The big faded icon on the right is decoration (art), so it
// is hidden from screen readers.
const statTiles = computed(() => [
  {
    key: "links",
    label: "Links",
    value: totalLinks.value,
    icon: "mdi-link-variant",
    art: "from-sky-500/25 to-brand-500/5 text-sky-500",
    title: "Manage your links",
  },
  {
    key: "categories",
    label: "Categories",
    value: appStore.totalCategories,
    icon: "mdi-folder-multiple-outline",
    art: "from-amber-500/25 to-brand-500/5 text-amber-500",
    title: "Manage your categories",
  },
  {
    key: "tags",
    label: "Tags",
    value: appStore.totalTags,
    icon: "mdi-tag-multiple-outline",
    art: "from-emerald-500/25 to-brand-500/5 text-emerald-500",
    title: "Manage your tags",
  },
]);

const ownSharedCount = computed(
  () => appStore.categories.filter((c) => c.is_shared).length,
);

async function openTag(tag) {
  appStore.search = "";
  appStore.filterCategory = "";
  await appStore.filterByTag(tag.id);
  router.push({ name: "view" });
}

const topVisitedLinks = computed(() =>
  appStore.visitStats.summary.slice(0, 5),
);
</script>

<template>
  <section class="space-y-4 sm:space-y-6">
    <header>
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
        Welcome back
      </h1>
      <p class="text-gray-600 dark:text-brand-300">Overview of your shelf</p>
    </header>

    <div class="grid grid-cols-3 gap-2 sm:gap-4">
      <button
        v-for="tile in statTiles"
        :key="tile.key"
        class="group relative overflow-hidden bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-3 sm:p-5 text-left hover:border-brand-500 transition-colors"
        :title="tile.title"
        :data-testid="`stat-${tile.key}`"
        @click="router.push({ name: 'edit' })"
      >
        <!-- Icon art: a soft glow with an oversized, tilted icon -->
        <span
          class="pointer-events-none absolute -right-4 -bottom-5 sm:-right-3 sm:-bottom-6 size-20 sm:size-28 rounded-full bg-linear-to-br blur-md"
          :class="tile.art"
          aria-hidden="true"
        ></span>
        <i
          class="stat-art mdi pointer-events-none absolute -right-2 -bottom-3 sm:right-1 sm:-bottom-4 text-5xl sm:text-7xl leading-none opacity-25 dark:opacity-30 -rotate-12 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110"
          :class="[tile.icon, tile.art.split(' ').pop()]"
          aria-hidden="true"
        ></i>
        <p class="relative text-sm text-gray-600 dark:text-brand-300">
          {{ tile.label }}
        </p>
        <p class="relative text-2xl sm:text-3xl font-bold">{{ tile.value }}</p>
      </button>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
      <button
        class="p-3 sm:p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        title="Browse your links"
        @click="router.push({ name: 'view' })"
      >
        <h2 class="font-semibold">
          <i class="mdi mdi-eye-outline mr-1"></i>View links
        </h2>
        <p class="hidden sm:block text-sm text-gray-600 dark:text-brand-300">
          Browse categories and shared collections
        </p>
      </button>
      <button
        class="p-3 sm:p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        title="Add and change links, tags and categories"
        @click="router.push({ name: 'edit' })"
      >
        <h2 class="font-semibold">
          <i class="mdi mdi-pencil-outline mr-1"></i>Edit links
        </h2>
        <p class="hidden sm:block text-sm text-gray-600 dark:text-brand-300">
          Manage links, tags and categories
        </p>
      </button>
      <button
        class="p-3 sm:p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        title="See what you share and what is shared with you"
        @click="router.push({ name: 'profile', query: { section: 'sharing' } })"
      >
        <h2 class="font-semibold">
          <i class="mdi mdi-account-group-outline mr-1"></i>Sharing
        </h2>
        <p class="text-xs sm:text-sm text-gray-600 dark:text-brand-300">
          {{ ownSharedCount }} shared by you ·
          {{ appStore.sharedCategories.length }} shared with you
        </p>
      </button>
      <button
        class="p-3 sm:p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        title="Settings and account"
        @click="router.push({ name: 'profile' })"
      >
        <h2 class="font-semibold">
          <i class="mdi mdi-account-outline mr-1"></i>Profile
        </h2>
        <p class="hidden sm:block text-sm text-gray-600 dark:text-brand-300">
          Settings and account actions
        </p>
      </button>
      <button
        class="p-3 sm:p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        title="Import or export your links and categories"
        @click="router.push({ name: 'profile' })"
      >
        <h2 class="font-semibold">
          <i class="mdi mdi-swap-horizontal mr-1"></i>Import Data
        </h2>
        <p class="hidden sm:block text-sm text-gray-600 dark:text-brand-300">
          Import or export your links and categories
        </p>
      </button>
    </div>

    <!-- Tags -->
    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-4 sm:p-5"
    >
      <h2 class="font-semibold text-gray-900 dark:text-white mb-1">
        <i class="mdi mdi-tag-multiple-outline mr-1"></i>Tags
      </h2>
      <template v-if="allTags.length">
        <p class="text-sm text-gray-500 dark:text-brand-400 mb-3">
          Tap a tag to see every link that has it, across all categories.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="tag in tagCloud"
            :key="tag.id"
            class="flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 dark:bg-brand-800 text-gray-700 dark:text-brand-200 hover:bg-brand-600 hover:text-white transition-colors"
            :class="tag.sizeClass"
            :title="`Show the ${tag.usage_count || 0} links tagged ${tag.name}`"
            @click="openTag(tag)"
          >
            #{{ tag.name }}
            <span class="text-xs opacity-60">{{ tag.usage_count || 0 }}</span>
          </button>
          <button
            v-if="hiddenTagCount && commonTags.length"
            class="text-xs text-brand-600 dark:text-brand-300 hover:underline px-1"
            :title="showAllTags ? 'Hide tags used on only one link' : 'Show tags used on only one link'"
            @click="showAllTags = !showAllTags"
          >
            {{
              showAllTags
                ? "Show fewer"
                : `Show ${hiddenTagCount} more (used once)`
            }}
          </button>
        </div>
      </template>
      <p v-else class="text-sm text-gray-500 dark:text-brand-400">
        Tags group links across categories, like "work", "recipes" or
        "read later". Add them when you create or edit a link, then come back
        here to jump straight to everything with that tag.
      </p>
    </article>

    <!-- Visit Stats -->
    <article
      v-if="appStore.visitStats.total_visits > 0 || appStore.visitStats.summary.length > 0"
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-4 sm:p-5"
    >
      <div class="flex items-baseline justify-between gap-2 mb-2">
        <h2 class="font-semibold text-gray-900 dark:text-white">
          <i class="mdi mdi-chart-bar mr-1"></i>Link visits
          <span class="text-xs font-normal text-gray-500 dark:text-brand-400"
            >last {{ appStore.visitStats.days }} days</span
          >
        </h2>
        <p class="text-sm text-gray-500 dark:text-brand-400 shrink-0">
          <span class="text-lg font-bold text-gray-900 dark:text-white">{{
            appStore.visitStats.total_visits
          }}</span>
          total
        </p>
      </div>
      <ul v-if="topVisitedLinks.length" class="divide-y divide-gray-100 dark:divide-brand-800">
        <li
          v-for="item in topVisitedLinks"
          :key="item.id"
          class="flex items-center justify-between gap-2 text-sm py-1"
        >
          <span class="truncate text-gray-700 dark:text-brand-200">{{ item.title }}</span>
          <span class="shrink-0 text-xs text-brand-600 dark:text-brand-400 font-medium">{{ item.visit_count }}</span>
        </li>
      </ul>
    </article>

    <!-- Theme Toggle -->
    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-4 sm:p-5"
    >
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold text-gray-900 dark:text-white">Theme</h2>
          <p class="text-sm text-gray-600 dark:text-brand-300">
            {{ isDark ? "Dark mode" : "Light mode" }}
          </p>
        </div>
        <button
          class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-brand-800 transition-colors"
          @click="toggleTheme()"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <i
            class="mdi text-xl"
            :class="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          ></i>
        </button>
      </div>
    </article>
  </section>
</template>
