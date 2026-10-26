<script setup>
import { ref, watch, nextTick, onUnmounted } from "vue";
import { useDialogStore } from "@/stores/dialog";

// Renders the dialog from the dialog store; see stores/dialog.js
const dialog = useDialogStore();
const confirmButton = ref(null);
const input = ref(null);

// Escape closes only this dialog, not a modal open underneath it
function handleKeydown(e) {
  if (e.key !== "Escape") return;
  e.stopImmediatePropagation();
  dialog.close(false);
}

watch(
  () => dialog.current,
  async (current) => {
    window.removeEventListener("keydown", handleKeydown, true);
    if (current) {
      window.addEventListener("keydown", handleKeydown, true);
      await nextTick();
      if (current.kind === "prompt") {
        input.value?.focus();
        input.value?.select();
      } else {
        confirmButton.value?.focus();
      }
    }
  },
);

onUnmounted(() =>
  window.removeEventListener("keydown", handleKeydown, true),
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="dialog.current"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      class="fixed inset-0 z-[95] bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      @click.self="dialog.close(false)"
    >
      <div
        class="w-full sm:max-w-sm bg-white dark:bg-brand-900 rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 dark:border-brand-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5"
      >
        <div class="flex items-start gap-3">
          <i
            v-if="dialog.current.icon"
            :class="[
              dialog.current.icon,
              dialog.current.danger ? 'text-red-500' : 'text-brand-500',
            ]"
            class="mdi text-2xl leading-none mt-0.5"
            aria-hidden="true"
          ></i>
          <div class="min-w-0 flex-1">
            <h2
              id="confirm-dialog-title"
              class="font-semibold text-gray-900 dark:text-white"
            >
              {{ dialog.current.title }}
            </h2>
            <p
              id="confirm-dialog-message"
              class="mt-1 text-sm text-gray-600 dark:text-brand-300"
            >
              {{ dialog.current.message }}
            </p>
            <input
              v-if="dialog.current.kind === 'prompt'"
              ref="input"
              v-model="dialog.current.value"
              :type="dialog.current.inputType"
              :placeholder="dialog.current.placeholder"
              :aria-label="dialog.current.title"
              class="mt-3 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-800"
              @keydown.enter.prevent="dialog.close(true)"
            />
          </div>
        </div>
        <div class="mt-5 flex gap-2 justify-end">
          <button
            v-if="dialog.current.kind !== 'alert'"
            type="button"
            class="flex-1 sm:flex-none px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700 text-sm"
            :title="dialog.current.cancelText"
            @click="dialog.close(false)"
          >
            {{ dialog.current.cancelText }}
          </button>
          <button
            ref="confirmButton"
            type="button"
            class="flex-1 sm:flex-none px-4 py-2 rounded-md text-sm text-white"
            :class="
              dialog.current.danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand-600 hover:bg-brand-700'
            "
            :title="dialog.current.confirmText"
            @click="dialog.close(true)"
          >
            {{ dialog.current.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
