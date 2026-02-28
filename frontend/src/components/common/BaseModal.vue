<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "",
  },
});

defineEmits(["close"]);
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
    @click.self="$emit('close')"
  >
    <div
      class="w-full max-w-xl bg-white dark:bg-brand-900 rounded-lg shadow-xl border border-gray-200 dark:border-brand-800"
    >
      <header
        class="px-4 py-3 border-b border-gray-200 dark:border-brand-800 flex justify-between items-center"
      >
        <h2 class="font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
        <button
          class="text-gray-500 hover:text-gray-900 dark:text-brand-300 dark:hover:text-white"
          @click="$emit('close')"
        >
          ✕
        </button>
      </header>
      <section class="p-4">
        <slot />
      </section>
    </div>
  </div>
</template>
