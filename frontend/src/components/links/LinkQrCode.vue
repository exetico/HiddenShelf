<script setup>
import { ref, watch } from "vue";
import QRCode from "qrcode";

// A QR code for a public link, with a button to save it as a PNG
const props = defineProps({
  url: { type: String, required: true },
  name: { type: String, default: "link" },
});

const image = ref("");
const failed = ref(false);

watch(
  () => props.url,
  async (url) => {
    failed.value = false;
    try {
      image.value = await QRCode.toDataURL(url, { margin: 1, width: 480 });
    } catch {
      image.value = "";
      failed.value = true;
    }
  },
  { immediate: true },
);

const fileName = () =>
  `${props.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "link"}-qr.png`;
</script>

<template>
  <div class="flex items-center gap-3" data-testid="link-qr">
    <img
      v-if="image"
      :src="image"
      :alt="`QR code for ${url}`"
      class="w-32 h-32 rounded-md bg-white p-1 border border-gray-200 dark:border-brand-700"
    />
    <p v-else-if="failed" class="text-sm text-red-600">Couldn't make a QR code</p>
    <div class="text-xs text-gray-500 dark:text-brand-400 space-y-2">
      <p>Scan it to open the public link on another device.</p>
      <a
        v-if="image"
        :href="image"
        :download="fileName()"
        class="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 dark:border-brand-700 text-gray-700 dark:text-brand-200 hover:bg-gray-50 dark:hover:bg-brand-800"
        title="Save the QR code as a picture"
      >
        <i class="mdi mdi-download" aria-hidden="true"></i> Save image
      </a>
    </div>
  </div>
</template>
