<script setup>
import { computed, ref } from "vue";
import LinkQrCode from "@/components/links/LinkQrCode.vue";
import { INPUT, OUTLINE } from "./styles";
import { useAppStore } from "@/stores/app";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { LONG_QR_URL, parseUrl } from "@/lib/urlTools";
import { ownLinks } from "@/lib/shelfTools";
import { appUrl } from "@/lib/appUrl";
import { WIFI_SECURITY, wifiPayload } from "@/lib/wifiQr";

// QR code for anything typed, one of your links, or your Wi-Fi
const appStore = useAppStore();
const editor = useLinkEditorStore();
const mode = ref("text");
const text = ref("");

// Wi-Fi: the password stays in this page; the code is drawn here too
const wifi = ref({ ssid: "", password: "", security: "WPA", hidden: false });
const showPassword = ref(false);
const wifiValue = computed(() => wifiPayload(wifi.value));

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
    <div class="inline-flex rounded-lg bg-gray-100 dark:bg-brand-800 p-1 text-sm" role="tablist" aria-label="What the code holds">
      <button
        v-for="m in [{ key: 'text', label: 'Link or text', icon: 'mdi-link-variant' }, { key: 'wifi', label: 'Wi-Fi network', icon: 'mdi-wifi' }]"
        :key="m.key"
        type="button"
        role="tab"
        :aria-selected="mode === m.key"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors"
        :class="mode === m.key ? 'bg-white dark:bg-brand-900 shadow-sm font-medium' : 'text-gray-600 dark:text-brand-300'"
        :title="m.key === 'wifi' ? 'A code that joins your Wi-Fi when scanned' : 'A code for an address or any text'"
        :data-testid="`qr-mode-${m.key}`"
        @click="mode = m.key"
      >
        <i class="mdi" :class="m.icon" aria-hidden="true"></i> {{ m.label }}
      </button>
    </div>

    <template v-if="mode === 'wifi'">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <label class="block text-sm font-medium" for="wifi-ssid">Network name</label>
          <input id="wifi-ssid" v-model="wifi.ssid" :class="INPUT" placeholder="MyHomeWiFi" autocomplete="off" data-testid="wifi-ssid" />
        </div>
        <div class="space-y-1">
          <label class="block text-sm font-medium" for="wifi-security">Security</label>
          <select id="wifi-security" v-model="wifi.security" :class="INPUT" data-testid="wifi-security">
            <option v-for="s in WIFI_SECURITY" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div v-if="wifi.security !== 'nopass'" class="space-y-1">
          <label class="block text-sm font-medium" for="wifi-password">Password</label>
          <div class="flex gap-1.5">
            <input
              id="wifi-password"
              v-model="wifi.password"
              :type="showPassword ? 'text' : 'password'"
              :class="INPUT"
              autocomplete="off"
              data-testid="wifi-password"
            />
            <button type="button" :class="OUTLINE" :title="showPassword ? 'Hide the password' : 'Show the password'" @click="showPassword = !showPassword">
              <i class="mdi" :class="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm sm:self-end sm:pb-2">
          <input v-model="wifi.hidden" type="checkbox" /> The network is hidden
        </label>
      </div>
      <div v-if="wifiValue" class="rounded-lg bg-gray-50 dark:bg-brand-800/50 p-4">
        <LinkQrCode
          :url="wifiValue"
          :name="`wifi-${wifi.ssid}`"
          large
          :alt="`QR code to join the Wi-Fi network ${wifi.ssid}`"
          :hint="`Point a phone camera at it to join ${wifi.ssid}. Save it and print it for guests. The password never leaves this page.`"
        />
      </div>
      <div
        v-else
        class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 dark:border-brand-800 py-10 text-gray-400 dark:text-brand-500"
      >
        <i class="mdi mdi-wifi text-5xl" aria-hidden="true"></i>
        <p class="text-sm">Type your network's name to make a code</p>
      </div>
    </template>

    <template v-else>
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
    </template>
  </div>
</template>
