<script setup>
import { useToastStore } from "@/stores/toast";

const toastStore = useToastStore();
</script>

<template>
  <!-- z-[1000] keeps toasts above every modal (those use z-40..z-80) -->
  <div
    data-testid="toasts"
    class="fixed z-[1000] space-y-2 pointer-events-none inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] sm:inset-x-auto sm:top-4 sm:right-4 sm:w-[280px]"
  >
    <transition-group name="toast">
      <div
        v-for="item in toastStore.items"
        :key="item.id"
        class="pointer-events-auto rounded-lg text-white shadow-lg px-4 py-3 cursor-pointer overflow-hidden relative"
        :class="{
          'bg-green-600': item.type === 'success',
          'bg-red-600': item.type === 'error',
          'bg-blue-600': item.type === 'info',
        }"
        @click="toastStore.remove(item.id)"
      >
        <span class="flex items-center justify-between gap-3">
          <span>{{ item.message }}</span>
          <button
            v-if="item.action"
            type="button"
            class="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            :title="item.action.label"
            @click.stop="toastStore.runAction(item)"
          >
            {{ item.action.label }}
          </button>
        </span>
        <div
          class="absolute bottom-0 left-0 h-0.5 bg-white/40 toast-progress"
          :style="{ animationDuration: item.duration + 'ms' }"
        ></div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(8px);
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
</style>
