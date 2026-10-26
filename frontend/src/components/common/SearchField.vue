<script setup>
import { ref } from "vue";

// A search box with a clear button you can actually see (the browser's own
// little "x" is nearly invisible, and missing in Firefox). Escape clears too.
// Attributes (title, data-testid…) go on the input itself
defineOptions({ inheritAttrs: false });

const model = defineModel({ type: String, default: "" });
defineProps({
  placeholder: { type: String, default: "Search links" },
  // Shown at the right while the box is empty, e.g. a "/" shortcut hint
  hint: { type: String, default: "" },
});

const input = ref(null);
defineExpose({ input, focus: () => input.value?.focus() });

function clear() {
  model.value = "";
  input.value?.focus();
}

function onEscape(event) {
  if (model.value) model.value = "";
  else event.target.blur();
}
</script>

<template>
  <label class="relative flex-1 min-w-0 block">
    <span class="sr-only">{{ placeholder }}</span>
    <i
      class="mdi mdi-magnify absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-brand-400 pointer-events-none"
      aria-hidden="true"
    ></i>
    <input
      ref="input"
      v-model="model"
      type="search"
      :placeholder="placeholder"
      v-bind="$attrs"
      class="search-field w-full pl-8 pr-14 md:pr-16 py-1.5 rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-800 text-sm"
      @keydown.escape="onEscape"
    />
    <!-- Drawn like the "/" hint so the two read as one family; the button
         itself is larger than the chip so it stays easy to tap -->
    <button
      v-if="model"
      type="button"
      class="group absolute right-1 top-1/2 -translate-y-1/2 p-1 flex items-center"
      title="Clear the search (Esc)"
      aria-label="Clear the search"
      data-testid="search-clear"
      @click="clear"
    >
      <span
        class="flex items-center gap-0.5 px-1.5 rounded border border-gray-300 dark:border-brand-600 text-[10px] leading-4 font-sans text-gray-600 dark:text-brand-200 group-hover:bg-gray-100 group-hover:text-gray-900 dark:group-hover:bg-brand-700 dark:group-hover:text-white"
        data-testid="search-clear-chip"
      >
        <i class="mdi mdi-close leading-none" aria-hidden="true"></i>
        <span class="hidden md:inline">Esc</span>
      </span>
    </button>
    <kbd
      v-else-if="hint"
      class="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 rounded border border-gray-300 dark:border-brand-600 text-[10px] leading-4 text-gray-400 dark:text-brand-400 font-sans pointer-events-none"
      aria-hidden="true"
      >{{ hint }}</kbd
    >
  </label>
</template>
