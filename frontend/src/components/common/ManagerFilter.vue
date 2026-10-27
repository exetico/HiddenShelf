<script setup>
// The filter box at the top of the tag and category managers
const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);

// Esc clears the filter first; with nothing typed it closes the dialog
function onEscape(event) {
  if (!props.modelValue) return;
  event.stopPropagation();
  emit("update:modelValue", "");
}
</script>

<template>
  <label class="relative block">
    <span class="sr-only">{{ label }}</span>
    <i
      class="mdi mdi-magnify pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-lg leading-none text-gray-400 dark:text-brand-400"
      aria-hidden="true"
    ></i>
    <input
      :value="modelValue"
      type="search"
      :placeholder="label"
      data-testid="manager-filter"
      class="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      @input="emit('update:modelValue', $event.target.value)"
      @keydown.esc="onEscape"
    />
  </label>
</template>
