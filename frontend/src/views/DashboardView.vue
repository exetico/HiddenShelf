<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useTheme } from "@/composables/useTheme";
import { useContextMenuStore } from "@/stores/contextMenu";
import { useDialogStore } from "@/stores/dialog";
import { useToastStore } from "@/stores/toast";
import { linksApi } from "@/services/api/linksApi";
import { filterHref, isPlainClick } from "@/lib/filterLinks";

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
    tint: "to-sky-500/15 dark:to-sky-400/15",
    iconColor: "text-sky-500 dark:text-sky-400",
    bar: "bg-sky-500/70",
    title: "Browse your links",
    to: "view",
  },
  {
    key: "categories",
    label: "Categories",
    value: appStore.totalCategories,
    icon: "mdi-folder-multiple-outline",
    tint: "to-amber-500/15 dark:to-amber-400/15",
    iconColor: "text-amber-500 dark:text-amber-400",
    bar: "bg-amber-500/70",
    title: "Manage your categories",
    to: "edit",
  },
  {
    key: "tags",
    label: "Tags",
    value: appStore.totalTags,
    icon: "mdi-tag-multiple-outline",
    tint: "to-emerald-500/15 dark:to-emerald-400/15",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    bar: "bg-emerald-500/70",
    title: "Manage your tags",
    to: "edit",
  },
]);

const ownSharedCount = computed(
  () => appStore.categories.filter((c) => c.is_shared).length,
);

// Right-click on a tag
const menu = useContextMenuStore();
function openTagMenu(event, tag) {
  menu.show(event, {
    title: `#${tag.name}`,
    items: [
      { label: "Show its links", icon: "mdi-filter-outline", action: () => openTag(tag) },
      { divider: true },
      {
        label: "Delete tag",
        icon: "mdi-delete-outline",
        danger: true,
        action: async () => {
          const ok = await useDialogStore().confirmDelete({
            title: `Delete tag "${tag.name}"?`,
            message: "It will be removed from all links. This can't be undone.",
          });
          if (ok) await appStore.deleteTag(tag.id);
        },
      },
    ],
  });
}

// The quiet easter egg at the bottom: open a random link from your shelf.
// The tab opens right away (inside the click) so pop-up blockers allow it,
// and gets its address once the server has picked a link.
const feelingLucky = ref(false);
async function openRandomLink() {
  const tab = window.open("", "_blank");
  feelingLucky.value = true;
  try {
    const link = await linksApi.random();
    if (tab) {
      tab.opener = null;
      tab.location.href = link.url;
    } else {
      window.location.assign(link.url);
    }
  } catch (error) {
    tab?.close();
    useToastStore().error(
      error.message === "Your shelf is empty"
        ? "Add a link first, then try your luck"
        : "Couldn't pick a link, try again",
    );
  } finally {
    feelingLucky.value = false;
  }
}

async function openTag(tag) {
  appStore.search = "";
  appStore.filterCategory = "";
  await appStore.filterByTag(tag.id);
  router.push({ name: "view" });
}

// Bottom row: look, account and data
const settingsRow = computed(() => [
  {
    key: "theme",
    label: isDark.value ? "Light mode" : "Dark mode",
    icon: isDark.value ? "mdi-weather-sunny" : "mdi-weather-night",
    title: isDark.value ? "Switch to light mode" : "Switch to dark mode",
    action: () => toggleTheme(),
  },
  {
    key: "profile",
    label: "Profile",
    icon: "mdi-account-outline",
    title: "Settings and account",
    action: () => router.push({ name: "profile" }),
  },
  {
    key: "data",
    label: "Import / export",
    icon: "mdi-swap-horizontal",
    title: "Import or export your links and categories",
    action: () => router.push({ name: "profile", query: { section: "data" } }),
  },
]);

const topVisitedLinks = computed(() =>
  appStore.visitStats.summary.slice(0, 5),
);
</script>

<template>
  <section class="space-y-4 sm:space-y-6" data-testid="dashboard-page">
    <!-- One line: a greeting, not a banner -->
    <header class="flex flex-wrap items-baseline gap-x-3" data-testid="welcome">
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
        Welcome back
      </h1>
      <p class="text-sm text-gray-500 dark:text-brand-400">
        Here's your shelf at a glance
      </p>
    </header>

    <div class="grid grid-cols-3 gap-2 sm:gap-4">
      <button
        v-for="tile in statTiles"
        :key="tile.key"
        class="group relative overflow-hidden bg-white dark:bg-brand-900 bg-linear-to-br from-transparent from-40% rounded-lg border border-gray-200 dark:border-brand-800 p-3 sm:p-5 text-left hover:border-brand-500 transition-colors"
        :class="tile.tint"
        :title="tile.title"
        :data-testid="`stat-${tile.key}`"
        @click="router.push({ name: tile.to })"
      >
        <!-- Icon art: a thin color bar, a light tint towards the corner and
             a big icon cut off by the tile's edge. No blur, so it stays crisp. -->
        <span
          class="pointer-events-none absolute inset-x-0 top-0 h-0.5"
          :class="tile.bar"
          aria-hidden="true"
        ></span>
        <i
          class="stat-art mdi pointer-events-none absolute -right-3 -bottom-4 sm:-right-2 sm:-bottom-5 text-6xl sm:text-8xl leading-none opacity-20 dark:opacity-25 -rotate-12 transition-all duration-300 group-hover:-rotate-6 group-hover:opacity-35"
          :class="[tile.icon, tile.iconColor]"
          aria-hidden="true"
        ></i>
        <p class="relative text-sm text-gray-600 dark:text-brand-300">
          {{ tile.label }}
        </p>
        <p class="relative text-2xl sm:text-3xl font-bold">{{ tile.value }}</p>
      </button>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
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
        class="max-sm:col-span-2 p-3 sm:p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
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
          <!-- Real links, so Ctrl/⌘-click opens the list in a new tab -->
          <a
            v-for="tag in tagCloud"
            :key="tag.id"
            :href="filterHref('view', { tag: tag.id })"
            class="flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 dark:bg-brand-800 text-gray-700 dark:text-brand-200 hover:bg-brand-600 hover:text-white transition-colors"
            :class="tag.sizeClass"
            :title="`Show the ${tag.usage_count || 0} links tagged ${tag.name}`"
            @click="isPlainClick($event) && ($event.preventDefault(), openTag(tag))"
            @contextmenu="openTagMenu($event, tag)"
          >
            #{{ tag.name }}
            <span class="text-xs opacity-60">{{ tag.usage_count || 0 }}</span>
          </a>
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

    <!-- Settings row: the whole button is the target -->
    <div class="grid grid-cols-3 gap-2 sm:gap-3" data-testid="settings-row">
      <button
        v-for="item in settingsRow"
        :key="item.key"
        type="button"
        class="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 p-2.5 sm:p-3 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 hover:border-brand-500 text-xs sm:text-sm text-gray-700 dark:text-brand-200 text-center sm:text-left"
        :title="item.title"
        :data-testid="`settings-${item.key}`"
        @click="item.action()"
      >
        <i class="mdi text-lg leading-none" :class="item.icon" aria-hidden="true"></i>
        <span>{{ item.label }}</span>
      </button>
    </div>

    <!-- Easter egg -->
    <p class="text-center pt-2 pb-4">
      <button
        type="button"
        class="text-xs text-gray-400 dark:text-brand-600 hover:text-brand-600 dark:hover:text-brand-300 transition-colors disabled:opacity-50"
        title="Open a random link from your shelf in a new tab"
        :disabled="feelingLucky"
        data-testid="feeling-lucky"
        @click="openRandomLink"
      >
        <i class="mdi mdi-dice-5-outline" aria-hidden="true"></i>
        I'm feeling lucky
      </button>
    </p>
  </section>
</template>
