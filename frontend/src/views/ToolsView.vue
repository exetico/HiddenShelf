<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import LinkQrCode from "@/components/links/LinkQrCode.vue";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { useToastStore } from "@/stores/toast";
import {
  LONG_QR_URL,
  TOOLS,
  cleanTracking,
  decodeText,
  encodeText,
  parseUrl,
  toolQuery,
  urlParts,
} from "@/lib/urlTools";

// Small link tools. Everything runs in the browser; nothing typed here is
// sent to the server unless you save it to your shelf.
const route = useRoute();
const router = useRouter();
const editor = useLinkEditorStore();
const toast = useToastStore();

// The open tool is in the address (?tool=), so the dashboard can link to it
const active = computed(() =>
  TOOLS.some((t) => t.key === route.query.tool) ? route.query.tool : TOOLS[0].key,
);
function pick(key) {
  router.replace({ name: "tools", query: toolQuery(key) });
}

async function copy(text, message = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
}

// QR code
const qrText = ref("");
const qrValue = computed(() => {
  const text = qrText.value.trim();
  if (!text) return "";
  return parseUrl(text)?.href || text;
});
const qrIsLong = computed(() => qrValue.value.length > LONG_QR_URL && Boolean(parseUrl(qrValue.value)));
function saveToShelf(url) {
  editor.create({ url });
}

// Encode / decode
const codeText = ref("");
const codeMode = ref("component");
const encoded = computed(() => encodeText(codeText.value, codeMode.value));
const decoded = computed(() => {
  try {
    return { text: decodeText(codeText.value), error: "" };
  } catch {
    return { text: "", error: "This isn't valid percent-encoding (a % must be followed by two hex digits)." };
  }
});

// Clean link
const cleanText = ref("");
const cleaned = computed(() => (cleanText.value.trim() ? cleanTracking(cleanText.value) : null));

// Inspect link
const inspectText = ref("");
const parts = computed(() => (inspectText.value.trim() ? urlParts(inspectText.value) : null));

const INPUT =
  "w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-800 text-gray-900 dark:text-white";
const OUTLINE =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-brand-700 text-gray-800 dark:text-brand-100 hover:bg-gray-50 dark:hover:bg-brand-800";
</script>

<template>
  <section class="space-y-4" data-testid="tools-page">
    <header>
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Tools</h1>
      <p class="text-sm text-gray-500 dark:text-brand-400">
        Small helpers for links. They run in your browser; nothing is sent
        anywhere unless you save it to your shelf.
      </p>
    </header>

    <!-- Scrolls sideways on narrow phones instead of wrapping -->
    <div
      class="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1"
      role="tablist"
      aria-label="Tools"
    >
      <button
        v-for="tool in TOOLS"
        :key="tool.key"
        role="tab"
        :aria-selected="active === tool.key"
        :title="tool.hint"
        class="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm rounded-md border transition-colors"
        :class="
          active === tool.key
            ? 'bg-brand-600 border-brand-600 text-white'
            : 'border-gray-300 dark:border-brand-700 text-gray-800 dark:text-brand-100 hover:bg-white dark:hover:bg-brand-800'
        "
        :data-testid="`tool-tab-${tool.key}`"
        @click="pick(tool.key)"
      >
        <i class="mdi" :class="tool.icon" aria-hidden="true"></i>
        {{ tool.label }}
      </button>
    </div>

    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-4 sm:p-5 space-y-3"
      role="tabpanel"
      :data-testid="`tool-${active}`"
    >
      <!-- QR code -->
      <template v-if="active === 'qr'">
        <label class="block text-sm font-medium" for="qr-text">Address or text</label>
        <input
          id="qr-text"
          v-model="qrText"
          :class="INPUT"
          placeholder="https://example.com"
          autocomplete="off"
          data-testid="qr-input"
        />
        <LinkQrCode
          v-if="qrValue"
          :url="qrValue"
          name="qr"
          hint="Scan it with a phone camera."
        />
        <div
          v-if="qrIsLong"
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
            type="button"
            :class="OUTLINE"
            title="Add this address to your shelf"
            data-testid="qr-save"
            @click="saveToShelf(qrValue)"
          >
            <i class="mdi mdi-plus" aria-hidden="true"></i> Add link
          </button>
        </div>
      </template>

      <!-- Encode / decode -->
      <template v-else-if="active === 'encode'">
        <label class="block text-sm font-medium" for="code-text">Text</label>
        <textarea
          id="code-text"
          v-model="codeText"
          rows="3"
          :class="INPUT"
          placeholder="Paste text or an address"
          data-testid="code-input"
        ></textarea>
        <fieldset class="flex flex-wrap gap-4 text-sm">
          <legend class="sr-only">How much to encode</legend>
          <label class="flex items-center gap-1.5" title="Encode everything, for one query value">
            <input v-model="codeMode" type="radio" value="component" /> A query value
          </label>
          <label class="flex items-center gap-1.5" title="Keep : / ? # & = so it stays a working address">
            <input v-model="codeMode" type="radio" value="url" data-testid="code-mode-url" /> A whole address
          </label>
        </fieldset>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-medium">Encoded</h2>
              <button type="button" class="text-sm text-brand-600 dark:text-brand-300" title="Copy the encoded text" :disabled="!codeText" @click="copy(encoded)">
                <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy
              </button>
            </div>
            <output class="block min-h-10 break-all font-mono text-sm rounded-md bg-gray-50 dark:bg-brand-800 p-2" data-testid="code-encoded">{{ encoded }}</output>
          </div>
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-medium">Decoded</h2>
              <button type="button" class="text-sm text-brand-600 dark:text-brand-300" title="Copy the decoded text" :disabled="!decoded.text" @click="copy(decoded.text)">
                <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy
              </button>
            </div>
            <output v-if="!decoded.error" class="block min-h-10 break-all font-mono text-sm rounded-md bg-gray-50 dark:bg-brand-800 p-2" data-testid="code-decoded">{{ decoded.text }}</output>
            <p v-else class="text-sm text-red-600 dark:text-red-400" data-testid="code-error">{{ decoded.error }}</p>
          </div>
        </div>
      </template>

      <!-- Clean link -->
      <template v-else-if="active === 'clean'">
        <label class="block text-sm font-medium" for="clean-text">Address</label>
        <input
          id="clean-text"
          v-model="cleanText"
          :class="INPUT"
          placeholder="https://example.com/?utm_source=newsletter"
          autocomplete="off"
          data-testid="clean-input"
        />
        <p v-if="cleanText.trim() && !cleaned" class="text-sm text-red-600 dark:text-red-400">
          That doesn't look like a web address.
        </p>
        <template v-else-if="cleaned">
          <output class="block break-all font-mono text-sm rounded-md bg-gray-50 dark:bg-brand-800 p-2" data-testid="clean-output">{{ cleaned.url }}</output>
          <p class="text-sm text-gray-600 dark:text-brand-300" data-testid="clean-removed">
            {{
              cleaned.removed.length
                ? `Removed ${cleaned.removed.join(", ")}.`
                : "No tracking found; the address is unchanged."
            }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button type="button" :class="OUTLINE" title="Copy the clean address" @click="copy(cleaned.url)">
              <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy
            </button>
            <button type="button" :class="OUTLINE" title="Add the clean address to your shelf" data-testid="clean-save" @click="saveToShelf(cleaned.url)">
              <i class="mdi mdi-plus" aria-hidden="true"></i> Add link
            </button>
          </div>
        </template>
      </template>

      <!-- Inspect link -->
      <template v-else>
        <label class="block text-sm font-medium" for="inspect-text">Address</label>
        <input
          id="inspect-text"
          v-model="inspectText"
          :class="INPUT"
          placeholder="https://example.com/path?q=search"
          autocomplete="off"
          data-testid="inspect-input"
        />
        <p v-if="inspectText.trim() && !parts" class="text-sm text-red-600 dark:text-red-400">
          That doesn't look like a web address.
        </p>
        <dl v-else-if="parts" class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="inspect-parts">
          <dt class="text-gray-500 dark:text-brand-400">Protocol</dt><dd class="font-mono break-all">{{ parts.protocol }}</dd>
          <dt class="text-gray-500 dark:text-brand-400">Host</dt><dd class="font-mono break-all">{{ parts.host }}</dd>
          <template v-if="parts.port"><dt class="text-gray-500 dark:text-brand-400">Port</dt><dd class="font-mono">{{ parts.port }}</dd></template>
          <dt class="text-gray-500 dark:text-brand-400">Path</dt><dd class="font-mono break-all">{{ parts.path }}</dd>
          <template v-if="parts.hash"><dt class="text-gray-500 dark:text-brand-400">Fragment</dt><dd class="font-mono break-all">{{ parts.hash }}</dd></template>
        </dl>
        <table v-if="parts?.params.length" class="w-full text-sm" data-testid="inspect-params">
          <caption class="text-left font-medium pb-1">Query parameters</caption>
          <tbody>
            <tr v-for="(param, i) in parts.params" :key="i" class="border-t border-gray-100 dark:border-brand-800">
              <th scope="row" class="py-1 pr-3 text-left font-mono font-normal align-top break-all">
                {{ param.name }}
                <span v-if="param.tracking" class="ml-1 text-xs text-amber-700 dark:text-amber-300">tracking</span>
              </th>
              <td class="py-1 font-mono break-all">{{ param.value }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </article>
  </section>
</template>
