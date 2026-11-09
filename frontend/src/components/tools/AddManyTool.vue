<script setup>
import { computed, ref } from "vue";
import { INPUT, PRIMARY, TONES } from "./styles";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { linksApi } from "@/services/api/linksApi";
import { extractUrls, sameUrlKey, titleFromUrl } from "@/lib/shelfTools";
import { cleanTracking } from "@/lib/urlTools";
import { LIMITS } from "@/lib/limits";

// Add many links: paste text, add every new address in it
const MAX_AT_ONCE = 200;

const appStore = useAppStore();
const text = ref("");
const categoryId = ref("");
const tagText = ref("");
const stripTracking = ref(true);
const adding = ref(false);
const added = ref(0);

const onShelf = computed(() => {
  const keys = new Set();
  for (const link of appStore.allLinks) {
    const key = sameUrlKey(link.url);
    if (key) keys.add(key);
  }
  return keys;
});

// What's in the paste: each address, cleaned if asked, and whether you have it
const found = computed(() =>
  extractUrls(text.value).map((raw) => {
    const url = stripTracking.value ? cleanTracking(raw)?.url || raw : raw;
    return { url, title: titleFromUrl(url), have: onShelf.value.has(sameUrlKey(url)) };
  }),
);
const fresh = computed(() => found.value.filter((f) => !f.have && f.url.length <= LIMITS.url));
const tooMany = computed(() => fresh.value.length > MAX_AT_ONCE);
const tags = computed(() =>
  [...new Set(tagText.value.split(",").map((t) => t.trim()).filter(Boolean))],
);

async function addAll() {
  adding.value = true;
  added.value = 0;
  const toAdd = fresh.value.slice(0, MAX_AT_ONCE);
  try {
    for (const item of toAdd) {
      await linksApi.create({
        url: item.url,
        title: item.title,
        category_id: categoryId.value || null,
        tags: tags.value,
      });
      added.value++;
    }
    useToastStore().success(`Added ${added.value} link${added.value === 1 ? "" : "s"}`);
    text.value = "";
  } catch (error) {
    useToastStore().error(`Added ${added.value}, then: ${error.message}`);
  } finally {
    adding.value = false;
    await Promise.all([appStore.refreshLinks(), tags.value.length && appStore.loadTags()]);
  }
}
</script>

<template>
  <div class="space-y-4" data-testid="add-many-tool">
    <div class="space-y-1">
      <label class="block text-sm font-medium" for="add-many-text">Paste links</label>
      <textarea
        id="add-many-text"
        v-model="text"
        rows="6"
        :class="INPUT"
        class="font-mono text-sm"
        placeholder="https://example.com/article&#10;github.com/someone/project&#10;…or a whole email with links in it"
        data-testid="add-many-input"
      ></textarea>
      <p class="text-xs text-gray-500 dark:text-brand-400">
        Tip: most browsers can copy all open tabs' addresses at once (select the tabs, then Copy links).
      </p>
    </div>

    <template v-if="found.length">
      <p class="flex flex-wrap gap-2 text-sm" data-testid="add-many-summary">
        <span class="px-2.5 py-1 rounded-full" :class="TONES.good">{{ fresh.length }} new</span>
        <span v-if="found.length - fresh.length" class="px-2.5 py-1 rounded-full" :class="TONES.quiet">
          {{ found.length - fresh.length }} already on your shelf
        </span>
      </p>
      <ul class="max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-brand-800 divide-y divide-gray-100 dark:divide-brand-800 text-sm">
        <li
          v-for="item in found"
          :key="item.url"
          class="flex items-center gap-2 px-3 py-1.5"
          :class="item.have && 'opacity-60'"
          data-testid="add-many-item"
        >
          <i
            class="mdi shrink-0"
            :class="item.have ? 'mdi-check-all text-gray-400' : 'mdi-plus-circle-outline text-emerald-600 dark:text-emerald-400'"
            :title="item.have ? 'Already on your shelf' : 'Will be added'"
          ></i>
          <span class="min-w-0 flex-1">
            <span class="block truncate">{{ item.title }}</span>
            <span class="block truncate text-xs font-mono text-gray-500 dark:text-brand-400">{{ item.url }}</span>
          </span>
          <span v-if="item.have" class="text-xs text-gray-500 dark:text-brand-400 shrink-0">Have it</span>
        </li>
      </ul>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <label class="block text-sm font-medium" for="add-many-category">Category</label>
          <select id="add-many-category" v-model="categoryId" :class="INPUT" data-testid="add-many-category">
            <option value="">No category</option>
            <option v-for="cat in appStore.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="block text-sm font-medium" for="add-many-tags">Tags</label>
          <input id="add-many-tags" v-model="tagText" :class="INPUT" placeholder="read later, research" autocomplete="off" data-testid="add-many-tags" />
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="stripTracking" type="checkbox" data-testid="add-many-strip" />
        Remove tracking (utm_source, fbclid …) from the addresses
      </label>
      <p v-if="tooMany" class="text-sm text-amber-700 dark:text-amber-300">
        That's a lot. The first {{ MAX_AT_ONCE }} are added now; paste the rest after.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          :class="PRIMARY"
          :disabled="!fresh.length || adding"
          title="Add every new link in the list"
          data-testid="add-many-submit"
          @click="addAll"
        >
          <i class="mdi" :class="adding ? 'mdi-loading mdi-spin' : 'mdi-playlist-plus'" aria-hidden="true"></i>
          {{ adding ? `Adding ${added + 1} of ${Math.min(fresh.length, MAX_AT_ONCE)}…` : `Add ${Math.min(fresh.length, MAX_AT_ONCE)} link${fresh.length === 1 ? "" : "s"}` }}
        </button>
        <p class="text-xs text-gray-500 dark:text-brand-400">Titles come from the address; you can change them later.</p>
      </div>
    </template>
    <p v-else-if="text.trim()" class="text-sm text-gray-600 dark:text-brand-300" data-testid="add-many-nothing">
      No web addresses found in that text.
    </p>
  </div>
</template>
