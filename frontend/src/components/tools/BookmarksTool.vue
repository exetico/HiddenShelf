<script setup>
import { computed, ref } from "vue";
import { INPUT, OUTLINE, PRIMARY, TONES } from "./styles";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { categoriesApi } from "@/services/api/categoriesApi";
import { linksApi } from "@/services/api/linksApi";
import { exportBookmarks, folderCategory, parseBookmarks } from "@/lib/bookmarks";
import { downloadText } from "@/lib/download";
import { ownLinks, sameUrlKey, titleFromUrl } from "@/lib/shelfTools";

// Browser bookmarks: import a bookmarks file, or save the shelf as one.
// The file is read here in the browser; only the links you import are sent.
const appStore = useAppStore();
const toast = useToastStore();

// ── Import ──
const fileName = ref("");
const bookmarks = ref([]);
const readError = ref("");
const useFolders = ref(true);
const fallbackCategory = ref("");
const extraTag = ref("");

async function pickFile(event) {
  const file = event.target.files?.[0];
  readError.value = "";
  bookmarks.value = [];
  fileName.value = file?.name || "";
  if (!file) return;
  try {
    bookmarks.value = parseBookmarks(await file.text());
    if (!bookmarks.value.length) readError.value = "No web links in that file. Is it a bookmarks file exported from a browser?";
  } catch {
    readError.value = "Couldn't read that file.";
  }
}

const onShelf = computed(() => new Set(appStore.allLinks.map((l) => sameUrlKey(l.url)).filter(Boolean)));
// New links only, and each page once even if the file has it twice
const fresh = computed(() => {
  const seen = new Set(onShelf.value);
  return bookmarks.value.filter((b) => {
    const key = sameUrlKey(b.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});
const skipped = computed(() => bookmarks.value.length - fresh.value.length);

// Folder name → how many new links it brings, and whether it's a new category
const existingByName = computed(
  () => new Map(appStore.categories.map((c) => [c.name.trim().toLowerCase(), c])),
);
const folders = computed(() => {
  const counts = new Map();
  for (const b of fresh.value) {
    const name = folderCategory(b);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, exists: existingByName.value.has(name.toLowerCase()) }))
    .sort((a, b) => b.count - a.count);
});
const newCategories = computed(() => folders.value.filter((f) => !f.exists).length);

const importing = ref(false);
const done = ref(0);
let stopRequested = false;

function stop() {
  stopRequested = true;
}

async function runImport() {
  importing.value = true;
  done.value = 0;
  stopRequested = false;
  const toAdd = [...fresh.value];
  const categoryIds = new Map(
    [...existingByName.value.entries()].map(([name, c]) => [name, c.id]),
  );
  try {
    if (useFolders.value)
      for (const folder of folders.value) {
        const key = folder.name.toLowerCase();
        if (categoryIds.has(key)) continue;
        const created = await categoriesApi.create({ name: folder.name });
        categoryIds.set(key, created.id);
      }
    for (const b of toAdd) {
      if (stopRequested) break;
      const folder = folderCategory(b).toLowerCase();
      const categoryId = (useFolders.value && folder && categoryIds.get(folder)) || fallbackCategory.value || null;
      const tags = [...new Set([...b.tags, ...(extraTag.value.trim() ? [extraTag.value.trim()] : [])])];
      await linksApi.create({ url: b.url, title: b.title || titleFromUrl(b.url), category_id: categoryId, tags });
      done.value++;
    }
    toast.success(`Imported ${done.value} link${done.value === 1 ? "" : "s"}`);
    bookmarks.value = [];
    fileName.value = "";
  } catch (error) {
    toast.error(`Imported ${done.value}, then: ${error.message}`);
  } finally {
    importing.value = false;
    await Promise.all([appStore.refreshLinks(), appStore.loadCategories(), appStore.loadTags()]);
  }
}

// ── Export ──
const own = computed(() => ownLinks(appStore.allLinks));
function saveFile() {
  const html = exportBookmarks(own.value, appStore.categories, { name: appStore.appConfig.site_name || "Hidden Shelf" });
  downloadText(html, `hidden-shelf-bookmarks-${new Date().toISOString().slice(0, 10)}.html`, "text/html");
  toast.success("Bookmarks file saved");
}
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-[3fr_2fr]" data-testid="bookmarks-tool">
    <section class="space-y-3" data-testid="bookmarks-import">
      <h2 class="font-semibold text-gray-900 dark:text-white">
        <i class="mdi mdi-tray-arrow-down" aria-hidden="true"></i> Import from a browser
      </h2>
      <p class="text-sm text-gray-600 dark:text-brand-300">
        In your browser, export bookmarks to a file (Chrome and Edge: Bookmark manager › ⋮ › Export.
        Firefox: Bookmarks › Manage › Import and Backup › Export to HTML. Safari: File › Export › Bookmarks).
        Then pick that file here.
      </p>
      <label
        class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 dark:border-brand-700 py-6 px-3 text-center cursor-pointer hover:border-brand-500"
      >
        <i class="mdi mdi-file-upload-outline text-3xl text-gray-400 dark:text-brand-400" aria-hidden="true"></i>
        <span class="text-sm font-medium">{{ fileName || "Choose a bookmarks file (.html)" }}</span>
        <span class="text-xs text-gray-500 dark:text-brand-400">It's read in your browser</span>
        <input type="file" accept=".html,.htm,text/html" class="sr-only" data-testid="bookmarks-file" @change="pickFile" />
      </label>
      <p v-if="readError" class="text-sm text-red-600 dark:text-red-400" data-testid="bookmarks-error">{{ readError }}</p>

      <template v-if="bookmarks.length">
        <p class="flex flex-wrap gap-2 text-sm" data-testid="bookmarks-summary">
          <span class="px-2.5 py-1 rounded-full" :class="TONES.good">{{ fresh.length }} new</span>
          <span v-if="skipped" class="px-2.5 py-1 rounded-full" :class="TONES.quiet">{{ skipped }} already on your shelf</span>
          <span v-if="folders.length" class="px-2.5 py-1 rounded-full" :class="TONES.quiet">
            {{ folders.length }} folder{{ folders.length === 1 ? "" : "s" }}
          </span>
        </p>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="useFolders" type="checkbox" class="mt-1" data-testid="bookmarks-use-folders" />
          <span>
            Folders become categories
            <span v-if="useFolders && newCategories" class="block text-xs text-gray-500 dark:text-brand-400">
              Makes {{ newCategories }} new categor{{ newCategories === 1 ? "y" : "ies" }}; folders with a category's name go into it.
            </span>
          </span>
        </label>
        <ul v-if="useFolders && folders.length" class="flex flex-wrap gap-1.5 text-xs" data-testid="bookmarks-folders">
          <li
            v-for="folder in folders.slice(0, 24)"
            :key="folder.name"
            class="px-2 py-0.5 rounded-md border border-gray-200 dark:border-brand-700"
          >
            <i class="mdi" :class="folder.exists ? 'mdi-folder-outline' : 'mdi-folder-plus-outline'" aria-hidden="true"></i>
            {{ folder.name }} <span class="text-gray-500 dark:text-brand-400">{{ folder.count }}</span>
          </li>
          <li v-if="folders.length > 24" class="px-2 py-0.5 text-gray-500">+{{ folders.length - 24 }} more</li>
        </ul>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <label class="block text-sm font-medium" for="bookmarks-category">
              {{ useFolders ? "Links outside folders go to" : "Put every link in" }}
            </label>
            <select id="bookmarks-category" v-model="fallbackCategory" :class="INPUT">
              <option value="">No category</option>
              <option v-for="cat in appStore.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium" for="bookmarks-tag">Tag them with</label>
            <input id="bookmarks-tag" v-model="extraTag" :class="INPUT" placeholder="imported" autocomplete="off" />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button
            v-if="!importing"
            type="button"
            :class="PRIMARY"
            :disabled="!fresh.length"
            title="Add the new links to your shelf"
            data-testid="bookmarks-import-start"
            @click="runImport"
          >
            <i class="mdi mdi-tray-arrow-down" aria-hidden="true"></i> Import {{ fresh.length }} link{{ fresh.length === 1 ? "" : "s" }}
          </button>
          <button v-else type="button" :class="OUTLINE" title="Stop importing" @click="stop">
            <i class="mdi mdi-stop" aria-hidden="true"></i> Stop
          </button>
          <p v-if="importing" class="text-sm text-gray-600 dark:text-brand-300" aria-live="polite">
            Importing {{ done }} of {{ fresh.length }}…
          </p>
        </div>
      </template>
    </section>

    <section class="space-y-3 lg:border-l lg:pl-5 border-gray-100 dark:border-brand-800" data-testid="bookmarks-export">
      <h2 class="font-semibold text-gray-900 dark:text-white">
        <i class="mdi mdi-tray-arrow-up" aria-hidden="true"></i> Save as a bookmarks file
      </h2>
      <p class="text-sm text-gray-600 dark:text-brand-300">
        Your {{ own.length }} links in a file any browser can import, in a "Hidden Shelf" folder with one folder per
        category. Handy for a new computer, or to have your shelf offline in the bookmarks bar.
      </p>
      <button type="button" :class="OUTLINE" :disabled="!own.length" title="Save your links as a bookmarks file" data-testid="bookmarks-export-save" @click="saveFile">
        <i class="mdi mdi-download" aria-hidden="true"></i> Save bookmarks file
      </button>
      <p class="text-xs text-gray-500 dark:text-brand-400">
        For a full backup you can restore here, use Import / export on your Profile page instead.
      </p>
    </section>
  </div>
</template>
