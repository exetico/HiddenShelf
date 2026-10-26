<script setup>
import { ref, watch, nextTick, onUnmounted } from "vue";

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close"]);
const modalRef = ref(null);

function handleKeydown(e) {
  if (e.key === "Escape") {
    emit("close");
  }
}

// Focus trap + keyboard handling
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeydown);
      await nextTick();
      modalRef.value?.focus();
    } else {
      document.removeEventListener("keydown", handleKeydown);
    }
  },
);

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center sm:p-4"
      @click.self="$emit('close')"
    >
      <div
        ref="modalRef"
        tabindex="-1"
        class="w-full max-w-xl max-h-[90dvh] flex flex-col bg-white dark:bg-brand-900 rounded-t-2xl sm:rounded-lg shadow-xl border border-gray-200 dark:border-brand-800 outline-hidden"
      >
        <header
          class="px-4 py-3 border-b border-gray-200 dark:border-brand-800 flex justify-between items-center"
        >
          <h2 class="font-semibold text-gray-900 dark:text-white">
            {{ title }}
          </h2>
          <button
            title="Close" aria-label="Close"
            class="text-gray-500 hover:text-gray-900 dark:text-brand-300 dark:hover:text-white"
            @click="$emit('close')"
          >
            ✕
          </button>
        </header>
        <section
          class="p-4 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4"
        >
          <slot />
        </section>
      </div>
    </div>
  </Teleport>
</template>
