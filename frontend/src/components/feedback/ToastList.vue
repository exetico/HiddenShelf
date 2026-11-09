<script setup>
import { useToastStore } from "@/stores/toast";

const toastStore = useToastStore();

// Toasts use the same surface as cards and dialogs. Only the small icon
// (and the thin timer line) carries the status color.
const STATUS = {
  success: {
    icon: "mdi-check-circle",
    tone: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500/60 dark:bg-emerald-400/50",
    label: "Done",
  },
  error: {
    icon: "mdi-alert-circle",
    tone: "text-red-600 dark:text-red-400",
    bar: "bg-red-500/60 dark:bg-red-400/50",
    label: "Error",
  },
  info: {
    icon: "mdi-information",
    tone: "text-brand-500 dark:text-brand-300",
    bar: "bg-brand-400/60 dark:bg-brand-300/50",
    label: "Info",
  },
};

function statusOf(item) {
  return STATUS[item.type] || STATUS.info;
}
</script>

<template>
  <!-- z-[1000] keeps toasts above every modal (those use z-40..z-80).
       Phones: bottom center, near the thumb and clear of the top menu.
       Wider screens: bottom right, out of the way of the content. -->
  <div
    data-testid="toasts"
    aria-live="polite"
    class="fixed z-[1000] flex flex-col gap-2 pointer-events-none inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[320px]"
  >
    <transition-group name="toast">
      <div
        v-for="item in toastStore.items"
        :key="item.id"
        :data-type="item.type"
        :role="item.type === 'error' ? 'alert' : 'status'"
        class="toast pointer-events-auto relative overflow-hidden cursor-pointer rounded-xl border border-gray-200 bg-white/95 text-gray-800 shadow-md backdrop-blur-sm dark:border-brand-700 dark:bg-brand-900/95 dark:text-brand-100"
        @click="toastStore.remove(item.id)"
      >
        <div class="flex items-center gap-2.5 px-3 py-2.5 text-sm">
          <i
            class="mdi text-lg leading-none shrink-0"
            :class="[statusOf(item).icon, statusOf(item).tone]"
            :aria-label="statusOf(item).label"
            role="img"
          ></i>
          <span class="min-w-0 flex-1 break-words">{{ item.message }}</span>
          <button
            v-if="item.action"
            type="button"
            class="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-800"
            :title="item.action.label"
            @click.stop="toastStore.runAction(item)"
          >
            {{ item.action.label }}
          </button>
          <button
            type="button"
            class="shrink-0 -mr-1 rounded-md p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-brand-400 dark:hover:text-white dark:hover:bg-brand-800"
            title="Dismiss"
            aria-label="Dismiss"
            @click.stop="toastStore.remove(item.id)"
          >
            <i class="mdi mdi-close text-base leading-none" aria-hidden="true"></i>
          </button>
        </div>
        <div
          class="absolute bottom-0 left-0 h-0.5 toast-progress"
          :class="statusOf(item).bar"
          :style="{ animationDuration: item.duration + 'ms' }"
        ></div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.toast-progress {
  animation: shrink linear forwards;
}
@keyframes shrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
