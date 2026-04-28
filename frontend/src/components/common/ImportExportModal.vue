<script setup>
import { ref, reactive } from "vue";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { linksApi } from "@/services/api/linksApi";
import { categoriesApi } from "@/services/api/categoriesApi";
import { tagsApi } from "@/services/api/tagsApi";
import BaseModal from "@/components/common/BaseModal.vue";

defineProps({
  open: Boolean,
});

const emit = defineEmits(["close"]);

const appStore = useAppStore();
const toastStore = useToastStore();

// Import state
const importJson = ref("");
const importError = ref("");
const importPreview = ref(false);
const importStats = reactive({
  newLinks: 0,
  duplicateLinks: 0,
  newCategories: 0,
  duplicateCategories: 0,
  newTags: 0,
  duplicateTags: 0,
});
let validatedImportData = null;

// Progress state
const showProgress = ref(false);
const progressText = ref("");
const progressPercent = ref(0);

function exportData() {
  // Separate own links from shared-category links
  const ownLinks = appStore.links.filter((l) => !l.is_from_shared_category);
  const sharedCount = appStore.links.length - ownLinks.length;

  const exportPayload = {
    links: ownLinks.map((link) => ({
      url: link.url,
      title: link.title,
      description: link.description || "",
      icon: link.icon || "",
      category: link.category_name || "",
      tags: (link.tags || []).map((t) => t.name),
      is_public: link.is_public ? true : false,
      direct_redirect: link.direct_redirect ? true : false,
      display_order: link.display_order || null,
    })),
    categories: appStore.categories.map((cat) => ({
      name: cat.name,
      icon: cat.icon || "",
      color: cat.color || "",
    })),
    tags: appStore.tags.map((tag) => ({
      name: tag.name,
    })),
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hiddenshelf-export-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (sharedCount > 0) {
    toastStore.success(
      `Exported ${ownLinks.length} ${ownLinks.length === 1 ? "link" : "links"}. ${sharedCount} shared-category ${sharedCount === 1 ? "link was" : "links were"} excluded (they belong to other users).`,
    );
  } else {
    toastStore.success("Data exported successfully!");
  }
}

async function validateImport() {
  importError.value = "";
  importPreview.value = false;
  importStats.newLinks = 0;
  importStats.duplicateLinks = 0;
  importStats.newCategories = 0;
  importStats.duplicateCategories = 0;
  importStats.newTags = 0;
  importStats.duplicateTags = 0;

  try {
    const data = JSON.parse(importJson.value);
    if (!data || typeof data !== "object") {
      throw new Error("Invalid JSON format");
    }

    // Fetch ALL existing links by paginating
    let allExistingLinks = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await linksApi.list({ page, limit: 500 });
      if (response.links && response.links.length > 0) {
        allExistingLinks = allExistingLinks.concat(response.links);
        if (response.pagination && page < response.pagination.pages) {
          page++;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    const validated = { links: [], categories: [], tags: [] };

    // Validate categories
    if (data.categories && Array.isArray(data.categories)) {
      const existingNames = appStore.categories.map((c) =>
        c.name.toLowerCase(),
      );
      for (const cat of data.categories) {
        if (!cat.name || typeof cat.name !== "string") {
          throw new Error("Category must have a valid name");
        }
        if (existingNames.includes(cat.name.toLowerCase())) {
          importStats.duplicateCategories++;
        } else {
          importStats.newCategories++;
          validated.categories.push({
            name: cat.name,
            icon: cat.icon || "",
            color: cat.color || "#687061",
          });
        }
      }
    }

    // Validate tags
    if (data.tags && Array.isArray(data.tags)) {
      const existingNames = appStore.tags.map((t) => t.name.toLowerCase());
      for (const tag of data.tags) {
        if (!tag.name || typeof tag.name !== "string") {
          throw new Error("Tag must have a valid name");
        }
        if (existingNames.includes(tag.name.toLowerCase())) {
          importStats.duplicateTags++;
        } else {
          importStats.newTags++;
          validated.tags.push({ name: tag.name });
        }
      }
    }

    // Validate links
    if (data.links && Array.isArray(data.links)) {
      const existingUrls = allExistingLinks.map((l) => l.url.toLowerCase());
      for (const link of data.links) {
        if (!link.url || typeof link.url !== "string") {
          throw new Error("Link must have a valid URL");
        }
        if (!link.title || typeof link.title !== "string") {
          throw new Error("Link must have a valid title");
        }
        if (existingUrls.includes(link.url.toLowerCase())) {
          importStats.duplicateLinks++;
        } else {
          importStats.newLinks++;
          validated.links.push({
            url: link.url,
            title: link.title,
            description: link.description || "",
            icon: link.icon || "",
            category: link.category || "",
            tags: Array.isArray(link.tags) ? link.tags : [],
            is_public: link.is_public ? true : false,
            direct_redirect: link.direct_redirect ? true : false,
            display_order: link.display_order || null,
          });
        }
      }
    }

    validatedImportData = validated;
    importPreview.value = true;

    const totalNew =
      importStats.newLinks + importStats.newCategories + importStats.newTags;
    if (totalNew === 0) {
      importError.value = "No new items to import. All items already exist.";
    }
  } catch (error) {
    importError.value = `Invalid JSON: ${error.message}`;
  }
}

// Import confirmation modal state
const showImportConfirmModal = ref(false);

async function requestImportConfirm() {
  if (!validatedImportData || !importPreview.value) {
    toastStore.error("Please validate the import first");
    return;
  }

  const totalNew =
    importStats.newLinks + importStats.newCategories + importStats.newTags;
  if (totalNew === 0) {
    toastStore.error("No new items to import");
    return;
  }

  showImportConfirmModal.value = true;
}

async function executeImport() {
  showImportConfirmModal.value = false;

  if (!validatedImportData || !importPreview.value) {
    toastStore.error("Please validate the import first");
    return;
  }

  const totalNew =
    importStats.newLinks + importStats.newCategories + importStats.newTags;
  if (totalNew === 0) {
    toastStore.error("No new items to import");
    return;
  }

  showProgress.value = true;
  progressText.value = "Starting import...";
  progressPercent.value = 0;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    let processed = 0;

    // Import categories first
    for (let i = 0; i < validatedImportData.categories.length; i++) {
      progressText.value = `Importing categories (${i + 1}/${validatedImportData.categories.length})...`;
      progressPercent.value = Math.floor((processed / totalNew) * 100);
      await categoriesApi.create(validatedImportData.categories[i]);
      processed++;
      await delay(100);
    }
    await appStore.loadCategories();

    // Import tags
    for (let i = 0; i < validatedImportData.tags.length; i++) {
      progressText.value = `Importing tags (${i + 1}/${validatedImportData.tags.length})...`;
      progressPercent.value = Math.floor((processed / totalNew) * 100);
      await tagsApi.create(validatedImportData.tags[i]);
      processed++;
      await delay(100);
    }
    await appStore.loadTags();

    // Import links
    for (let i = 0; i < validatedImportData.links.length; i++) {
      const link = validatedImportData.links[i];
      progressText.value = `Importing links (${i + 1}/${validatedImportData.links.length})...`;
      progressPercent.value = Math.floor((processed / totalNew) * 100);

      let category_id = null;
      if (link.category) {
        const cat = appStore.categories.find(
          (c) => c.name.toLowerCase() === link.category.toLowerCase(),
        );
        if (cat) category_id = cat.id;
      }

      await linksApi.create({
        url: link.url,
        title: link.title,
        description: link.description,
        icon: link.icon,
        category_id,
        tags: link.tags || [],
        is_public: link.is_public,
        direct_redirect: link.direct_redirect,
        display_order: link.display_order,
      });
      processed++;
      await delay(100);
    }

    progressPercent.value = 100;
    progressText.value = "Finalizing...";

    await appStore.loadLinks({ reset: true });
    await appStore.loadCategories();
    await appStore.loadTags();

    showProgress.value = false;
    toastStore.success(`Successfully imported ${totalNew} items!`);
    resetImport();
    emit("close");
  } catch (error) {
    showProgress.value = false;
    toastStore.error("Import failed: " + error.message);
  }
}

function resetImport() {
  importJson.value = "";
  importError.value = "";
  importPreview.value = false;
  validatedImportData = null;
}
</script>

<template>
  <BaseModal :open="open" title="Import / Export" @close="emit('close')">
    <div class="space-y-6">
      <!-- Export Section -->
      <div>
        <h3
          class="text-sm font-semibold text-gray-700 dark:text-brand-200 mb-2"
        >
          <i class="mdi mdi-export mr-1"></i> Export
        </h3>
        <p class="text-xs text-gray-500 dark:text-brand-400 mb-2">
          Download all your links, categories, and tags as JSON.
        </p>
        <button
          class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
          @click="exportData"
        >
          <i class="mdi mdi-download mr-1"></i> Export data
        </button>
      </div>

      <hr class="border-gray-200 dark:border-brand-800" />

      <!-- Import Section -->
      <div>
        <h3
          class="text-sm font-semibold text-gray-700 dark:text-brand-200 mb-2"
        >
          <i class="mdi mdi-import mr-1"></i> Import
        </h3>
        <p class="text-xs text-gray-500 dark:text-brand-400 mb-2">
          Paste a previously exported JSON to import.
        </p>
        <textarea
          v-model="importJson"
          class="w-full h-32 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800 text-sm font-mono"
          placeholder='{"links": [...], "categories": [...], "tags": [...]}'
        ></textarea>

        <div class="flex gap-2 mt-2">
          <button
            class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
            :disabled="!importJson.trim()"
            @click="validateImport"
          >
            Validate
          </button>
          <button
            v-if="importPreview"
            class="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
            :disabled="
              importStats.newLinks +
                importStats.newCategories +
                importStats.newTags ===
              0
            "
            @click="requestImportConfirm"
          >
            Import
          </button>
        </div>

        <!-- Error -->
        <p
          v-if="importError"
          class="mt-2 text-sm text-red-600 dark:text-red-400"
        >
          {{ importError }}
        </p>

        <!-- Preview Stats -->
        <div
          v-if="importPreview"
          class="mt-3 p-3 bg-gray-50 dark:bg-brand-800 rounded-md text-sm space-y-1"
        >
          <p class="font-semibold">Import Preview:</p>
          <p>
            <span class="text-green-600"
              >{{ importStats.newCategories }} new</span
            >
            /
            <span class="text-gray-500"
              >{{ importStats.duplicateCategories }} duplicate</span
            >
            categories
          </p>
          <p>
            <span class="text-green-600">{{ importStats.newTags }} new</span> /
            <span class="text-gray-500"
              >{{ importStats.duplicateTags }} duplicate</span
            >
            tags
          </p>
          <p>
            <span class="text-green-600">{{ importStats.newLinks }} new</span> /
            <span class="text-gray-500"
              >{{ importStats.duplicateLinks }} duplicate</span
            >
            links
          </p>
        </div>
      </div>

      <!-- Import Confirmation Modal -->
      <Teleport to="body">
        <div
          v-if="showImportConfirmModal"
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4"
          @click.self="showImportConfirmModal = false"
        >
          <div
            class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-sm w-full p-6"
          >
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Confirm Import
            </h3>
            <p class="text-sm text-gray-600 dark:text-brand-300 mb-4">
              Import
              <strong class="text-gray-900 dark:text-white">{{
                importStats.newLinks +
                importStats.newCategories +
                importStats.newTags
              }}</strong>
              new items? This cannot be undone.
            </p>
            <div class="flex justify-end gap-2">
              <button
                class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700"
                @click="showImportConfirmModal = false"
              >
                Cancel
              </button>
              <button
                class="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
                @click="executeImport"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Progress Modal -->
      <Teleport to="body">
        <div
          v-if="showProgress"
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4"
        >
          <div
            class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-sm w-full p-6"
          >
            <h3 class="text-lg font-semibold dark:text-white mb-4">
              Importing...
            </h3>
            <p class="text-sm text-gray-600 dark:text-brand-300 mb-3">
              {{ progressText }}
            </p>
            <div
              class="w-full bg-gray-200 dark:bg-brand-800 rounded-full h-2.5"
            >
              <div
                class="bg-brand-600 h-2.5 rounded-full transition-all"
                :style="{ width: `${progressPercent}%` }"
              ></div>
            </div>
            <p class="text-right text-xs text-gray-500 mt-1">
              {{ progressPercent }}%
            </p>
          </div>
        </div>
      </Teleport>
    </div>
  </BaseModal>
</template>
