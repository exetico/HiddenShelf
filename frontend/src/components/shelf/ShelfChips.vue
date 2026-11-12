<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useDialogStore } from "@/stores/dialog";
import { useToastStore } from "@/stores/toast";
import { filterHref, isPlainClick } from "@/lib/filterLinks";
import {
  MAX_SAVED_NAME,
  MAX_SAVED_SEARCHES,
  applySaved,
  currentQuery,
  isActive,
  suggestName,
} from "@/lib/savedSearches";

// One row above the links on View and Edit: the To read filter, your saved
// searches, and a button to save the filters that are on now.
const appStore = useAppStore();
const dialog = useDialogStore();
const toast = useToastStore();
const route = useRoute();

const page = computed(() => (route?.name === "edit" ? "edit" : "view"));
const current = computed(() => currentQuery(appStore));
const saved = computed(() => appStore.savedSearches);
const showToRead = computed(() => appStore.toReadCount > 0 || appStore.filterToRead);

// Something to save: a filter is on and no saved search shows it already
const canSave = computed(
  () => appStore.filtering && !saved.value.some((s) => isActive(s, current.value)),
);
const visible = computed(() => showToRead.value || saved.value.length || canSave.value);

function toggleToRead() {
  appStore.filterToRead = !appStore.filterToRead;
}

function open(event, entry) {
  // Ctrl/⌘-click opens it in a new tab, like any link
  if (!isPlainClick(event)) return;
  event.preventDefault();
  if (isActive(entry, current.value)) {
    // Tapping the one that's on turns it off again
    applySaved(appStore, { query: {} });
    return;
  }
  applySaved(appStore, entry);
}

async function save() {
  if (saved.value.length >= MAX_SAVED_SEARCHES) {
    toast.error(`You can keep up to ${MAX_SAVED_SEARCHES} saved searches. Remove one first.`);
    return;
  }
  const query = current.value;
  const name = await dialog.prompt({
    title: "Save this search",
    message: "It shows up as a chip above your links on View and Edit.",
    value: suggestName(query, { categories: appStore.categories, tags: appStore.tags }),
    icon: "mdi-bookmark-plus-outline",
  });
  const trimmed = (name || "").trim().slice(0, MAX_SAVED_NAME);
  if (!trimmed) return;
  try {
    await appStore.saveSavedSearches([...saved.value, { name: trimmed, query }]);
    toast.success(`Saved "${trimmed}"`);
  } catch (e) {
    toast.error(e?.message || "Couldn't save the search");
  }
}

async function remove(entry) {
  const ok = await dialog.confirm({
    title: `Remove "${entry.name}"?`,
    message: "Only the saved search goes. Your links stay as they are.",
    confirmText: "Remove",
    danger: true,
    icon: "mdi-bookmark-remove-outline",
  });
  if (!ok) return;
  try {
    await appStore.saveSavedSearches(saved.value.filter((s) => s !== entry));
  } catch (e) {
    toast.error(e?.message || "Couldn't remove the search");
  }
}

const chip =
  "inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs sm:text-sm whitespace-nowrap shrink-0 border transition-colors";
const on = "bg-brand-600 border-brand-600 text-white";
const off =
  "bg-white dark:bg-brand-900 border-gray-200 dark:border-brand-700 text-gray-700 dark:text-brand-200 hover:border-brand-400";
</script>

<template>
  <div
    v-if="visible"
    class="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5"
    data-testid="shelf-chips"
  >
    <button
      v-if="showToRead"
      type="button"
      :class="[chip, appStore.filterToRead ? on : off]"
      :aria-pressed="appStore.filterToRead"
      :title="appStore.filterToRead ? 'Show all links again' : 'Show only links you saved to read later'"
      data-testid="to-read-chip"
      @click="toggleToRead"
    >
      <i class="mdi mdi-book-clock-outline"></i>
      To read
      <span class="opacity-75">{{ appStore.toReadCount }}</span>
    </button>

    <span
      v-for="(entry, i) in saved"
      :key="`${i}-${entry.name}`"
      class="inline-flex shrink-0"
      :data-testid="`saved-search-${i}`"
    >
      <a
        :href="filterHref(page, entry.query)"
        :class="[chip, isActive(entry, current) ? `${on} rounded-r-none pr-2` : off]"
        :title="isActive(entry, current) ? `Turn off ${entry.name}` : `Show ${entry.name}`"
        :aria-current="isActive(entry, current) ? 'true' : undefined"
        @click="open($event, entry)"
      >
        <i class="mdi mdi-bookmark-outline"></i>
        {{ entry.name }}
      </a>
      <button
        v-if="isActive(entry, current)"
        type="button"
        :class="[chip, on, 'rounded-l-none pl-1.5 pr-2.5 border-l-white/30']"
        :title="`Remove the saved search ${entry.name}`"
        :aria-label="`Remove the saved search ${entry.name}`"
        data-testid="remove-saved-search"
        @click="remove(entry)"
      >
        <i class="mdi mdi-close"></i>
      </button>
    </span>

    <button
      v-if="canSave"
      type="button"
      :class="[chip, off, 'border-dashed']"
      title="Save the search and filters that are on now as a chip"
      data-testid="save-search"
      @click="save"
    >
      <i class="mdi mdi-bookmark-plus-outline"></i>
      Save search
    </button>
  </div>
</template>
