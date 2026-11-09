<script setup>
import { ref, watch } from "vue";
import QRCode from "qrcode";
import { saveImage } from "@/lib/saveImage";
import { useToastStore } from "@/stores/toast";

// A QR code for an address, with a button to save it as a PNG.
// `large` is the Tools page's bigger version, with the hint underneath.
const props = defineProps({
  url: { type: String, required: true },
  name: { type: String, default: "link" },
  hint: { type: String, default: "Scan it to open the public link on another device." },
  large: { type: Boolean, default: false },
  // Read out instead of "QR code for <url>" (a Wi-Fi code holds a password)
  alt: { type: String, default: "" },
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

// Safari on iPhone can't save a data: link, so this goes through the
// share sheet there (see lib/saveImage.js)
async function save() {
  try {
    const how = await saveImage(image.value, fileName());
    if (how === "downloaded") useToastStore().success("QR code saved");
  } catch {
    useToastStore().error("Couldn't save the picture. Press and hold it to save it instead.");
  }
}
</script>

<template>
  <div
    class="flex gap-3"
    :class="large ? 'flex-col items-center sm:flex-row sm:items-start gap-4' : 'items-center'"
    data-testid="link-qr"
  >
    <img
      v-if="image"
      :src="image"
      :alt="alt || `QR code for ${url}`"
      class="rounded-md bg-white p-1 border border-gray-200 dark:border-brand-700"
      :class="large ? 'w-56 h-56 sm:w-48 sm:h-48 shadow-sm' : 'w-32 h-32'"
    />
    <p v-else-if="failed" class="text-sm text-red-600">Couldn't make a QR code</p>
    <div class="text-xs text-gray-500 dark:text-brand-400 space-y-2" :class="large && 'text-sm text-center sm:text-left'">
      <p>{{ hint }}</p>
      <button
        v-if="image"
        type="button"
        class="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 dark:border-brand-700 text-gray-700 dark:text-brand-200 hover:bg-gray-50 dark:hover:bg-brand-800"
        :class="large && 'px-3 py-1.5 text-sm'"
        title="Save the QR code as a picture"
        data-testid="qr-save-image"
        @click="save"
      >
        <i class="mdi mdi-download" aria-hidden="true"></i> Save image
      </button>
    </div>
  </div>
</template>
