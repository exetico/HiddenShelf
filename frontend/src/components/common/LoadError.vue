<script setup>
/**
 * A card's "couldn't load" line, with a Try again button. When the server
 * couldn't be reached (it may be restarting), it says so calmly; the card
 * loads again by itself once the server answers (useReconnect).
 */
defineProps({
  message: { type: String, required: true },
  unreachable: { type: Boolean, default: false },
});
defineEmits(["retry"]);
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
    :class="unreachable ? 'text-gray-600 dark:text-brand-300' : 'text-red-600 dark:text-red-400'"
    role="status"
    data-testid="load-error"
  >
    <i
      class="mdi text-base leading-none"
      :class="unreachable ? 'mdi-cloud-off-outline' : 'mdi-alert-circle-outline'"
      aria-hidden="true"
    ></i>
    <!-- The notice at the bottom already explains; keep the card short -->
    <span class="min-w-0 flex-1">{{
      unreachable ? "Waiting for the server. This fills in by itself once it's back." : message
    }}</span>
    <button
      type="button"
      class="rounded-md border border-gray-300 dark:border-brand-700 px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-100 dark:text-brand-100 dark:hover:bg-brand-800"
      title="Try again"
      data-testid="load-error-retry"
      @click="$emit('retry')"
    >
      Try again
    </button>
  </div>
</template>
