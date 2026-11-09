<script setup>
import { computed, ref } from "vue";
import { INPUT, OUTLINE } from "./styles";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { useToastStore } from "@/stores/toast";
import { cleanTracking, decodeText, encodeText, urlParts } from "@/lib/urlTools";

// Inspect a link: its parts, its query parameters decoded, tracking
// flagged and a clean copy. Encode / decode text sits underneath.
const editor = useLinkEditorStore();
const toast = useToastStore();

async function copy(text, message = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
}

const text = ref("");
const parts = computed(() => (text.value.trim() ? urlParts(text.value) : null));
const cleaned = computed(() => (parts.value ? cleanTracking(text.value) : null));

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
</script>

<template>
  <div class="space-y-4" data-testid="inspect-tool">
    <div class="space-y-1">
      <label class="block text-sm font-medium" for="inspect-text">Address</label>
      <input
        id="inspect-text"
        v-model="text"
        :class="INPUT"
        placeholder="https://shop.example/item?id=42&utm_source=newsletter"
        autocomplete="off"
        data-testid="inspect-input"
      />
    </div>
    <p v-if="text.trim() && !parts" class="text-sm text-red-600 dark:text-red-400">
      That doesn't look like a web address.
    </p>

    <template v-if="parts">
      <!-- The clean version first: it's what most people come for -->
      <div
        class="rounded-lg border p-3 space-y-2"
        :class="
          cleaned.removed.length
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
        "
        data-testid="inspect-clean"
      >
        <p class="text-sm" data-testid="clean-removed">
          <i class="mdi" :class="cleaned.removed.length ? 'mdi-eye-off-outline' : 'mdi-check-circle-outline'" aria-hidden="true"></i>
          {{
            cleaned.removed.length
              ? `Tracks you with ${cleaned.removed.join(", ")}. Here it is without:`
              : "No tracking in this address."
          }}
        </p>
        <output v-if="cleaned.removed.length" class="block break-all font-mono text-sm rounded-md bg-white/70 dark:bg-brand-900/60 p-2" data-testid="clean-output">{{ cleaned.url }}</output>
        <div class="flex flex-wrap gap-2">
          <button type="button" :class="OUTLINE" title="Copy the clean address" @click="copy(cleaned.url)">
            <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy{{ cleaned.removed.length ? " clean link" : "" }}
          </button>
          <button type="button" :class="OUTLINE" title="Add the clean address to your shelf" data-testid="clean-save" @click="editor.create({ url: cleaned.url })">
            <i class="mdi mdi-plus" aria-hidden="true"></i> Add to shelf
          </button>
        </div>
      </div>

      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="inspect-parts">
        <dt class="text-gray-500 dark:text-brand-400">Protocol</dt><dd class="font-mono break-all">{{ parts.protocol }}</dd>
        <dt class="text-gray-500 dark:text-brand-400">Host</dt><dd class="font-mono break-all">{{ parts.host }}</dd>
        <template v-if="parts.port"><dt class="text-gray-500 dark:text-brand-400">Port</dt><dd class="font-mono">{{ parts.port }}</dd></template>
        <dt class="text-gray-500 dark:text-brand-400">Path</dt><dd class="font-mono break-all">{{ parts.path }}</dd>
        <template v-if="parts.hash"><dt class="text-gray-500 dark:text-brand-400">Fragment</dt><dd class="font-mono break-all">{{ parts.hash }}</dd></template>
      </dl>
      <table v-if="parts.params.length" class="w-full text-sm" data-testid="inspect-params">
        <caption class="text-left font-medium pb-1">Query parameters, decoded</caption>
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

    <details class="rounded-lg border border-gray-200 dark:border-brand-800 p-3" data-testid="inspect-encode">
      <summary class="cursor-pointer text-sm font-medium">
        <i class="mdi mdi-code-braces" aria-hidden="true"></i> Encode or decode text
        <span class="font-normal text-gray-500 dark:text-brand-400">(for putting text in an address)</span>
      </summary>
      <div class="mt-3 space-y-3">
        <textarea
          v-model="codeText"
          rows="2"
          :class="INPUT"
          aria-label="Text to encode or decode"
          placeholder="Paste text, or something with %20 in it"
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
              <h3 class="text-sm font-medium">Encoded</h3>
              <button type="button" class="text-sm text-brand-600 dark:text-brand-300" title="Copy the encoded text" :disabled="!codeText" @click="copy(encoded)">
                <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy
              </button>
            </div>
            <output class="block min-h-10 break-all font-mono text-sm rounded-md bg-gray-50 dark:bg-brand-800 p-2" data-testid="code-encoded">{{ encoded }}</output>
          </div>
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium">Decoded</h3>
              <button type="button" class="text-sm text-brand-600 dark:text-brand-300" title="Copy the decoded text" :disabled="!decoded.text" @click="copy(decoded.text)">
                <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy
              </button>
            </div>
            <output v-if="!decoded.error" class="block min-h-10 break-all font-mono text-sm rounded-md bg-gray-50 dark:bg-brand-800 p-2" data-testid="code-decoded">{{ decoded.text }}</output>
            <p v-else class="text-sm text-red-600 dark:text-red-400" data-testid="code-error">{{ decoded.error }}</p>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>
