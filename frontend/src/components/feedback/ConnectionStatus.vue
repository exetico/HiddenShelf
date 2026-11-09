<script setup>
/**
 * Shown while the server can't be reached (lib/connection.js): usually a
 * restart after an update, or the phone losing its network. It says the
 * app keeps trying, counts down to the next try, and offers "Try now".
 * It goes away by itself once the server answers again.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { connection, retryNow } from "@/lib/connection";

const now = ref(Date.now());
let tick = null;

watch(
  () => connection.down,
  (down) => {
    clearInterval(tick);
    tick = down ? setInterval(() => (now.value = Date.now()), 1000) : null;
    now.value = Date.now();
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(tick));

const seconds = computed(() =>
  Math.max(0, Math.ceil((connection.nextTryAt - now.value) / 1000)),
);
const when = computed(() => {
  if (connection.checking || seconds.value === 0) return "Trying again…";
  return `Trying again in ${seconds.value}s.`;
});
</script>

<template>
  <transition name="connection">
    <div
      v-if="connection.down"
      data-testid="connection-status"
      role="status"
      class="pointer-events-auto relative overflow-hidden rounded-xl border border-gray-200 bg-white/95 text-gray-800 shadow-md backdrop-blur-sm dark:border-brand-700 dark:bg-brand-900/95 dark:text-brand-100"
    >
      <div class="flex items-center gap-2.5 px-3 py-2.5 text-sm">
        <i
          class="mdi mdi-cloud-off-outline text-lg leading-none shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        ></i>
        <span class="min-w-0 flex-1">
          <span class="font-medium">Can't reach the server.</span>
          It may be restarting after an update. {{ when }}
        </span>
        <button
          type="button"
          class="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:text-brand-200 dark:hover:bg-brand-800"
          title="Try to reach the server now"
          data-testid="connection-retry"
          :disabled="connection.checking"
          @click="retryNow()"
        >
          Try now
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.connection-enter-active,
.connection-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.connection-enter-from,
.connection-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (prefers-reduced-motion: reduce) {
  .connection-enter-active,
  .connection-leave-active {
    transition: none;
  }
}
</style>
