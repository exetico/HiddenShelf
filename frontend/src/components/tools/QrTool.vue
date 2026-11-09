<script setup>
import { computed, ref } from "vue";
import LinkQrCode from "@/components/links/LinkQrCode.vue";
import { INPUT, OUTLINE } from "./styles";
import { useAppStore } from "@/stores/app";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { LONG_QR_URL, parseUrl } from "@/lib/urlTools";
import { ownLinks } from "@/lib/shelfTools";
import { appUrl } from "@/lib/appUrl";

// QR code for anything typed, or one of your links
const appStore = useAppStore();
const editor = useLinkEditorStore();
const text = ref("");

const value = computed(() => {
  const typed = text.value.trim();
  if (!typed) return "";
  return parseUrl(typed)?.href || typed;
});
const isLong = computed(() => value.value.length > LONG_QR_URL && Boolean(parseUrl(value.value)));
// Your links as suggestions in the box (a datalist: the browser filters it)
const suggestions = computed(() => ownLinks(appStore.allLinks).slice(0, 500));
const linkFor = computed(() => appStore.allLinks.find((l) => l.url === value.value));
// A public link has a short address, which makes a simpler code
const shortUrl = computed(() =>
  linkFor.value?.is_public && linkFor.value.hash
    ? appUrl(`/h/${linkFor.value.hash}`)
    : "",
);
</script>

<template>
  <div class="space-y-4" data-testid="qr-tool">
    <div class="space-y-1">
      <label class="block text-sm font-medium" for="qr-text">Address or text</label>
      <input
        id="qr-text"
        v-model="text"
        :class="INPUT"
        list="qr-shelf-links"
        placeholder="https://example.com, or start typing one of your links"
        autocomplete="off"
        data-testid="qr-input"
      />
      <datalist id="qr-shelf-links">
        <option v-for="link in suggestions" :key="link.id" :value="link.url">{{ link.title }}</option>
      </datalist>
    </div>

    <div v-if="value" class="rounded-lg bg-gray-50 dark:bg-brand-800/50 p-4">
      <LinkQrCode
        :url="shortUrl || value"
        :name="linkFor?.title || 'qr'"
        large
        :hint="shortUrl ? `Uses the link's short public address, ${shortUrl}, so the code is simpler to scan.` : 'Point a phone camera at it to open it.'"
      />
    </div>
    <div
      v-else
      class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 dark:border-brand-800 py-10 text-gray-400 dark:text-brand-500"
    >
      <i class="mdi mdi-qrcode text-5xl" aria-hidden="true"></i>
      <p class="text-sm">Your QR code shows up here</p>
    </div>

    <div
      v-if="isLong && !shortUrl"
      class="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-100"
      data-testid="qr-long-hint"
    >
      <i class="mdi mdi-lightbulb-on-outline" aria-hidden="true"></i>
      <p class="flex-1 min-w-[12rem]">
        Long addresses make dense codes that are harder to scan. Save it to
        your shelf, then use "Public link" on it for a short address and a
        simpler code.
      </p>
      <button
        v-if="!linkFor"
        type="button"
        :class="OUTLINE"
        title="Add this address to your shelf"
        data-testid="qr-save"
        @click="editor.create({ url: value })"
      >
        <i class="mdi mdi-plus" aria-hidden="true"></i> Add link
      </button>
    </div>
  </div>
</template>
