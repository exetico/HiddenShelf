<script setup>
import { computed, onUnmounted, ref, watch } from "vue";
import { usePublicShareStore } from "@/stores/publicShare";
import { useToastStore } from "@/stores/toast";
import { appUrl } from "@/lib/appUrl";
import LinkQrCode from "@/components/links/LinkQrCode.vue";
import { backdropClose } from "@/lib/backdropClose";
import { EMBED_HEIGHT, embedSnippet, embedUrl } from "@/lib/embed";

const share = usePublicShareStore();
const toast = useToastStore();

const url = computed(() => (share.link ? appUrl(`/h/${share.link.hash}`) : ""));

async function copy(text = url.value, message = "Public link copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
}

// Embedding: an iframe with a small card, for blogs and start pages
const embedTheme = ref("");
const snippet = computed(() =>
  share.link ? embedSnippet(url.value, share.link.title, embedTheme.value) : "",
);

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

// Closes on a backdrop click, but not when a text selection ends there
const backdrop = backdropClose(() => share.close());
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
      v-on="backdrop"
    >
      <div
        class="w-full sm:max-w-sm max-h-[90dvh] overflow-y-auto bg-white dark:bg-brand-900 rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 dark:border-brand-800 p-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
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
            @click="copy()"
          >
            <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy
          </button>
        </div>

        <LinkQrCode :url="url" :name="share.link.title" />

        <details class="group text-sm" data-testid="embed-section">
          <summary class="cursor-pointer select-none text-gray-700 dark:text-brand-200">
            <i class="mdi mdi-code-tags" aria-hidden="true"></i> Embed on a website
          </summary>
          <div class="mt-2 space-y-2">
            <p class="text-xs text-gray-500 dark:text-brand-400">
              Paste this into a page to show the link as a small card.
            </p>
            <label class="flex items-center gap-2 text-xs">
              Colors
              <select
                v-model="embedTheme"
                class="px-2 py-1 rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-800"
                data-testid="embed-theme"
              >
                <option value="">Follow the visitor</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <iframe
              :src="embedUrl(url, embedTheme)"
              :title="`Preview: ${share.link.title}`"
              :height="EMBED_HEIGHT"
              class="w-full border-0"
              loading="lazy"
              data-testid="embed-preview"
            ></iframe>
            <textarea
              :value="snippet"
              readonly
              rows="3"
              aria-label="Embed code"
              class="w-full text-xs font-mono rounded-md bg-gray-50 dark:bg-brand-800 border border-gray-200 dark:border-brand-700 p-2"
              data-testid="embed-code"
              @focus="$event.target.select()"
            ></textarea>
            <button
              type="button"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 dark:border-brand-700 text-gray-800 dark:text-brand-100 hover:bg-gray-50 dark:hover:bg-brand-800"
              title="Copy the embed code"
              data-testid="embed-copy"
              @click="copy(snippet, 'Embed code copied')"
            >
              <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy code
            </button>
          </div>
        </details>

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
