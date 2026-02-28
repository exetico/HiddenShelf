<script setup>
import { useToastStore } from "@/stores/toast";

const toastStore = useToastStore();
</script>

<template>
  <div class="fixed top-4 right-4 z-50 space-y-2 w-[280px]">
    <transition-group name="toast">
      <div
        v-for="item in toastStore.items"
        :key="item.id"
        class="rounded-lg text-white shadow-lg px-4 py-3 cursor-pointer"
        :class="{
          'bg-green-600': item.type === 'success',
          'bg-red-600': item.type === 'error',
          'bg-blue-600': item.type === 'info',
        }"
        @click="toastStore.remove(item.id)"
      >
        {{ item.message }}
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
</style>
