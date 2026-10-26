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
      class="search-field w-full pl-8 pr-9 py-1.5 rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-800 text-sm"
      @keydown.escape="onEscape"
    />
    <button
      v-if="model"
      type="button"
      class="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-brand-600 dark:text-white dark:hover:bg-brand-500"
      title="Clear the search"
      aria-label="Clear the search"
      data-testid="search-clear"
      @click="clear"
    >
      <i class="mdi mdi-close text-sm leading-none" aria-hidden="true"></i>
    </button>
    <kbd
      v-else-if="hint"
      class="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 rounded border border-gray-300 dark:border-brand-600 text-[10px] text-gray-400 dark:text-brand-400 font-sans pointer-events-none"
      aria-hidden="true"
      >{{ hint }}</kbd
    >
  </label>
</template>
