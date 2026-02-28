<script setup>
import { ref, reactive } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { linksApi } from "@/services/api/linksApi";
import { categoriesApi } from "@/services/api/categoriesApi";
import { tagsApi } from "@/services/api/tagsApi";
import ImportExportModal from "@/components/common/ImportExportModal.vue";

const authStore = useAuthStore();
const appStore = useAppStore();
const toastStore = useToastStore();

const form = reactive({
  links_per_page: appStore.settings.links_per_page,
  brand_color: appStore.settings.brand_color,
});

const shareCode = reactive({
  code: "",
});

const showImportExport = ref(false);
const showDangerZone = ref(false);
const showDeleteProgress = ref(false);
const deleteProgress = ref("");
const deleteProgressPercent = ref(0);

async function saveSettings() {
  await appStore.updateSettings({
    links_per_page: Number(form.links_per_page),
    brand_color: form.brand_color,
  });
}

function resetBrandColor() {
  form.brand_color = "#687061";
  saveSettings();
}

async function joinShare() {
  if (!shareCode.code.trim()) return;
  await appStore.acceptShare(shareCode.code.trim());
  shareCode.code = "";
}

async function confirmDeleteEverything() {
  const totalCount =
    appStore.total + appStore.categories.length + appStore.tags.length;
  const expectedAnswer = `delete ${totalCount} now`;

  const userInput = window.prompt(
    `This will permanently delete ALL your data including:\n\n` +
      `• All links (${appStore.total})\n` +
      `• All categories (${appStore.categories.length})\n` +
      `• All tags (${appStore.tags.length})\n\n` +
      `This action CANNOT be undone!\n\n` +
      `To confirm, type: ${expectedAnswer}`,
  );

  if (userInput !== expectedAnswer) {
    if (userInput !== null) {
      toastStore.error("Confirmation failed. Please type the exact phrase.");
    }
    return;
  }

  showDeleteProgress.value = true;
  deleteProgress.value = "Fetching all data...";
  deleteProgressPercent.value = 5;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    // Fetch all links
    let allLinks = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await linksApi.list({ page, limit: 500 });
      if (response.links && response.links.length > 0) {
        allLinks = allLinks.concat(response.links);
        if (response.pagination && page < response.pagination.pages) {
          page++;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    deleteProgressPercent.value = 10;
    const allCategories = appStore.categories;
    const allTags = appStore.tags;
    const totalItems = allLinks.length + allCategories.length + allTags.length;
    let deletedItems = 0;
    let failedDeletes = 0;

    deleteProgressPercent.value = 15;

    // Delete links
    for (let i = 0; i < allLinks.length; i++) {
      deleteProgress.value = `Deleting links (${i + 1}/${allLinks.length})...`;
      deleteProgressPercent.value =
        15 + Math.floor(((deletedItems + 1) / totalItems) * 75);
      try {
        await linksApi.remove(allLinks[i].id);
        deletedItems++;
      } catch {
        failedDeletes++;
        deletedItems++;
      }
      await delay(100);
    }

    // Delete tags
    for (let i = 0; i < allTags.length; i++) {
      deleteProgress.value = `Deleting tags (${i + 1}/${allTags.length})...`;
      deleteProgressPercent.value =
        15 + Math.floor(((deletedItems + 1) / totalItems) * 75);
      try {
        await tagsApi.remove(allTags[i].id);
        deletedItems++;
      } catch {
        failedDeletes++;
        deletedItems++;
      }
      await delay(100);
    }

    // Delete categories
    for (let i = 0; i < allCategories.length; i++) {
      deleteProgress.value = `Deleting categories (${i + 1}/${allCategories.length})...`;
      deleteProgressPercent.value =
        15 + Math.floor(((deletedItems + 1) / totalItems) * 75);
      try {
        await categoriesApi.remove(allCategories[i].id);
        deletedItems++;
      } catch {
        failedDeletes++;
        deletedItems++;
      }
      await delay(100);
    }

    deleteProgress.value = "Refreshing data...";
    deleteProgressPercent.value = 95;

    await appStore.loadLinks({ reset: true });
    await appStore.loadCategories();
    await appStore.loadTags();

    deleteProgressPercent.value = 100;
    deleteProgress.value = "Complete!";

    setTimeout(() => {
      showDeleteProgress.value = false;
      if (failedDeletes > 0) {
        toastStore.error(
          `Deleted ${deletedItems - failedDeletes} items with ${failedDeletes} errors.`,
        );
      } else {
        toastStore.success(`All ${deletedItems} items deleted successfully!`);
      }
    }, 500);
  } catch (error) {
    showDeleteProgress.value = false;
    toastStore.error("Failed to delete all data: " + error.message);
  }
}
</script>

<template>
  <section class="max-w-3xl space-y-6">
    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
    >
      <h1 class="text-2xl font-bold">Profile</h1>
      <p class="text-gray-600 dark:text-brand-300 mt-1">
        {{ authStore.user?.email }}
      </p>
    </article>

    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5 space-y-3"
    >
      <h2 class="text-lg font-semibold">Settings</h2>
      <label class="block text-sm">Links per page</label>
      <select
        v-model="form.links_per_page"
        class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      >
        <option :value="20">20</option>
        <option :value="50">50</option>
        <option :value="100">100</option>
        <option :value="250">250</option>
        <option :value="500">500</option>
      </select>

      <label class="block text-sm">Brand color</label>
      <div class="flex items-center gap-3">
        <input
          v-model="form.brand_color"
          type="color"
          class="h-10 w-20 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800 cursor-pointer"
        />
        <button
          class="text-xs text-gray-500 dark:text-brand-400 hover:text-gray-700 dark:hover:text-brand-200"
          @click="resetBrandColor"
        >
          Reset to default
        </button>
      </div>

      <button
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="saveSettings"
      >
        Save settings
      </button>
    </article>

    <!-- Import / Export -->
    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5 space-y-3"
    >
      <h2 class="text-lg font-semibold">Data</h2>
      <p class="text-sm text-gray-600 dark:text-brand-400">
        Export or import your links, categories, and tags.
      </p>
      <button
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="showImportExport = true"
      >
        <i class="mdi mdi-swap-horizontal mr-1"></i>
        Import / Export
      </button>
    </article>

    <ImportExportModal
      :open="showImportExport"
      @close="showImportExport = false"
    />

    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5 space-y-3"
    >
      <h2 class="text-lg font-semibold">Shared categories</h2>
      <form class="flex gap-2" @submit.prevent="joinShare">
        <input
          v-model="shareCode.code"
          placeholder="Share code"
          class="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        />
        <button
          class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        >
          Join
        </button>
      </form>

      <ul class="space-y-2">
        <li
          v-for="category in appStore.sharedCategories"
          :key="category.id"
          class="flex items-center justify-between border border-gray-200 dark:border-brand-800 rounded-md p-2"
        >
          <div>
            <p class="font-medium">{{ category.name }}</p>
            <p class="text-xs text-gray-500 dark:text-brand-400">
              Shared by {{ category.owner_email }}
            </p>
          </div>
          <button
            class="text-red-600 dark:text-red-400 text-sm"
            @click="appStore.leaveSharedCategory(category.id)"
          >
            Leave
          </button>
        </li>
      </ul>
    </article>

    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
    >
      <button
        class="px-4 py-2 rounded-md border border-red-400 text-red-700 dark:text-red-300"
        @click="authStore.logout"
      >
        Logout
      </button>
    </article>

    <!-- Danger Zone -->
    <article
      class="bg-red-50 dark:bg-red-950 rounded-lg border-2 border-red-300 dark:border-red-800 p-5"
    >
      <button
        class="w-full flex items-center justify-between text-left"
        @click="showDangerZone = !showDangerZone"
      >
        <h2 class="text-xl font-semibold text-red-600 dark:text-red-400">
          Danger Zone
        </h2>
        <i
          class="mdi text-red-600 dark:text-red-400 transition-transform"
          :class="showDangerZone ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        ></i>
      </button>

      <div v-if="showDangerZone" class="mt-4">
        <p class="text-sm text-gray-600 dark:text-brand-400 mb-4">
          These actions are irreversible. Please be certain before proceeding.
        </p>
        <button
          class="w-full px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
          @click="confirmDeleteEverything"
        >
          Delete Everything
        </button>
      </div>
    </article>

    <!-- Delete Progress Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteProgress"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      >
        <div
          class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-sm w-full p-6"
        >
          <h3 class="text-lg font-semibold dark:text-white mb-4">
            Deleting...
          </h3>
          <p class="text-sm text-gray-600 dark:text-brand-300 mb-3">
            {{ deleteProgress }}
          </p>
          <div class="w-full bg-gray-200 dark:bg-brand-800 rounded-full h-2.5">
            <div
              class="bg-red-600 h-2.5 rounded-full transition-all"
              :style="{ width: `${deleteProgressPercent}%` }"
            ></div>
          </div>
          <p class="text-right text-xs text-gray-500 mt-1">
            {{ deleteProgressPercent }}%
          </p>
        </div>
      </div>
    </Teleport>
  </section>
</template>
