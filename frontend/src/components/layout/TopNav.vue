<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { useTheme } from "@/composables/useTheme";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const appStore = useAppStore();
const { mode: theme, toggleTheme } = useTheme();

// The View/Edit switch always shows one side selected. Off those pages
// (dashboard, profile) it shows the mode you used last, dimmed.
const MODE_KEY = "hiddenshelf_last_mode";
function readLastMode() {
  try {
    return localStorage.getItem(MODE_KEY) === "edit" ? "edit" : "view";
  } catch {
    return "view";
  }
}
const lastMode = ref(readLastMode());
const onModePage = computed(() => ["view", "edit"].includes(route.name));
const mode = computed(() => (onModePage.value ? route.name : lastMode.value));

watch(
  () => route.name,
  (name) => {
    if (name !== "view" && name !== "edit") return;
    lastMode.value = name;
    try {
      localStorage.setItem(MODE_KEY, name);
    } catch {
      // private mode: the switch just falls back to View
    }
  },
  { immediate: true },
);

function goTo(name) {
  router.push({ name });
}

// Desktop: search and "Add link" live in the bar, so they're on every page.
// Searching from the dashboard or profile jumps to View with the results.
const searchInput = ref(null);
const searchText = computed({
  get: () => appStore.search,
  set: (value) => {
    appStore.search = value;
    if (value && route.name !== "view" && route.name !== "edit") goTo("view");
  },
});

function addLink() {
  router.push({ name: "edit", query: { new: "1" } });
}

// "/" jumps to the search box, unless you're already typing somewhere
function onKeydown(event) {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
  if (!searchInput.value || !searchInput.value.offsetParent) return; // hidden (phone)
  event.preventDefault();
  searchInput.value.focus();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

// It is a toggle: tapping the side you are already on flips to the other
function pickMode(name) {
  if (route.name === name) {
    goTo(name === "view" ? "edit" : "view");
  } else {
    goTo(name);
  }
}
</script>

<template>
  <header
    class="sticky top-0 z-30 bg-white/90 dark:bg-brand-900/90 backdrop-blur-md border-b border-gray-200 dark:border-brand-800 transition-colors"
  >
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 sm:h-16 flex items-center justify-between gap-2 sm:gap-4"
    >
      <button
        class="flex items-center text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-white shrink-0"
        title="Hidden Shelf: go to the dashboard"
        aria-label="Hidden Shelf home"
        @click="goTo('dashboard')"
      >
        <i class="mdi mdi-bookshelf text-3xl sm:text-4xl leading-none"></i>
      </button>

      <!-- Desktop only: search and add, the two things you do most -->
      <div class="hidden md:flex flex-1 max-w-lg items-center gap-2" data-testid="nav-tools">
        <label class="relative flex-1">
          <span class="sr-only">Search links</span>
          <i
            class="mdi mdi-magnify absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-brand-500"
            aria-hidden="true"
          ></i>
          <input
            ref="searchInput"
            v-model="searchText"
            type="search"
            placeholder="Search links"
            title="Search titles, descriptions, URLs and tags (press / to jump here)"
            class="w-full pl-8 pr-8 py-1.5 rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-800 text-sm"
            data-testid="nav-search"
            @keydown.escape="searchText = ''; $event.target.blur()"
          />
          <kbd
            v-if="!searchText"
            class="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 rounded border border-gray-300 dark:border-brand-600 text-[10px] text-gray-400 dark:text-brand-400 font-sans"
            aria-hidden="true"
            >/</kbd
          >
        </label>
        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700"
          title="Add a new link"
          data-testid="nav-add"
          @click="addLink"
        >
          <i class="mdi mdi-plus" aria-hidden="true"></i> Add link
        </button>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <div
          class="relative grid grid-cols-2 bg-gray-100 dark:bg-brand-800 rounded-lg p-0.5 sm:p-1"
          role="group"
          aria-label="Mode"
        >
          <!-- Sliding thumb behind the selected side -->
          <span
            class="absolute inset-y-0.5 sm:inset-y-1 left-0.5 sm:left-1 w-[calc(50%-2px)] sm:w-[calc(50%-4px)] rounded-md transition-all duration-200"
            :class="[
              mode === 'edit' ? 'translate-x-full' : 'translate-x-0',
              onModePage ? 'bg-brand-600' : 'bg-brand-600/25 dark:bg-brand-500/30',
            ]"
            data-testid="mode-thumb"
            aria-hidden="true"
          ></span>
          <button
            v-for="item in [
              { name: 'view', label: 'View', icon: 'mdi-view-list', hint: route.name === 'view' ? 'Switch to Edit' : 'Browse and open your links' },
              { name: 'edit', label: 'Edit', icon: 'mdi-pencil', hint: route.name === 'edit' ? 'Switch to View' : 'Add, change and organize links' },
            ]"
            :key="item.name"
            class="relative z-10 px-2 py-1 sm:px-3 sm:py-1.5 text-sm rounded-md transition-colors flex items-center justify-center gap-1.5"
            :class="
              mode === item.name && onModePage
                ? 'text-white'
                : 'text-gray-700 dark:text-brand-200 hover:text-brand-700 dark:hover:text-white'
            "
            :title="item.hint"
            :aria-current="route.name === item.name ? 'page' : undefined"
            @click="pickMode(item.name)"
          >
            <i :class="item.icon" class="mdi" aria-hidden="true"></i>
            <span class="max-[359px]:sr-only">{{ item.label }}</span>
          </button>
        </div>

        <button
          class="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full bg-brand-600 text-white text-sm font-semibold"
          :title="`Profile and settings (${authStore.user?.email || ''})`"
          aria-label="Profile and settings"
          :aria-current="route.name === 'profile' ? 'page' : undefined"
          @click="goTo('profile')"
        >
          {{ authStore.initials }}
        </button>

        <button
          class="p-1.5 sm:p-2 rounded-md text-gray-700 dark:text-brand-200 hover:bg-gray-100 dark:hover:bg-brand-800"
          :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <i
            :class="
              theme === 'dark'
                ? 'mdi mdi-weather-sunny'
                : 'mdi mdi-weather-night'
            "
            class="text-lg"
          ></i>
        </button>
      </div>
    </div>
  </header>
</template>
