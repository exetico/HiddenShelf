<script setup>
import { computed, onUnmounted, watch } from "vue";
import { usePublicShareStore } from "@/stores/publicShare";
import { useToastStore } from "@/stores/toast";
import { appUrl } from "@/lib/appUrl";
import LinkQrCode from "@/components/links/LinkQrCode.vue";

const share = usePublicShareStore();
const toast = useToastStore();

const url = computed(() => (share.link ? appUrl(`/h/${share.link.hash}`) : ""));

async function copy() {
  try {
    await navigator.clipboard.writeText(url.value);
    toast.success("Public link copied");
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
}

function onKeydown(event) {
  if (event.key === "Escape") share.close();
}
watch(
  () => Boolean(share.link),
  (open) => {
    window.removeEventListener("keydown", onKeydown);
    if (open) window.addEventListener("keydown", onKeydown);
  },
);
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="share.link"
      role="dialog"
      aria-modal="true"
      :aria-label="`Public link for ${share.link.title}`"
      class="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      data-testid="public-link-dialog"
      @click.self="share.close()"
    >
      <div
        class="w-full sm:max-w-sm bg-white dark:bg-brand-900 rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 dark:border-brand-800 p-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <header class="flex items-start gap-2">
          <i class="mdi mdi-earth text-xl text-green-600 dark:text-green-400" aria-hidden="true"></i>
          <div class="flex-1 min-w-0">
            <h2 class="font-semibold text-gray-900 dark:text-white">Public link</h2>
            <p class="text-sm text-gray-500 dark:text-brand-400 truncate">
              {{ share.link.title }}
            </p>
          </div>
          <button
            type="button"
            class="p-1 -m-1 rounded-md text-gray-500 hover:bg-gray-100 dark:text-brand-400 dark:hover:bg-brand-800"
            title="Close"
            aria-label="Close"
            @click="share.close()"
          >
            <i class="mdi mdi-close text-xl leading-none"></i>
          </button>
        </header>

        <div class="flex items-center gap-2 bg-gray-50 dark:bg-brand-800 rounded-md p-2">
          <input
            :value="url"
            readonly
            aria-label="Public link"
            class="flex-1 min-w-0 bg-transparent text-sm font-mono truncate border-none outline-hidden"
            @focus="$event.target.select()"
          />
          <button
            type="button"
            class="shrink-0 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700"
            title="Copy the public link"
            data-testid="public-link-copy"
            @click="copy"
          >
            <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy
          </button>
        </div>

        <LinkQrCode :url="url" :name="share.link.title" />

        <a
          :href="url"
          target="_blank"
          rel="noopener"
          class="block text-sm text-brand-600 dark:text-brand-300 hover:underline"
          title="Open the public page in a new tab"
        >
          <i class="mdi mdi-open-in-new" aria-hidden="true"></i> Open the public page
        </a>
      </div>
    </div>
  </Teleport>
</template>
