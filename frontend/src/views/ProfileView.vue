<script setup>
import { ref, reactive } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { sharesApi } from "@/services/api/sharesApi";
import { accountApi } from "@/services/api/accountApi";
import ImportExportModal from "@/components/common/ImportExportModal.vue";

const authStore = useAuthStore();
const appStore = useAppStore();
const toastStore = useToastStore();

const form = reactive({
  links_per_page: appStore.settings.links_per_page,
  brand_color: appStore.settings.brand_color,
});

// Join shared category state
const shareCode = reactive({ code: "" });
const showJoinModal = ref(false);
const joinLoading = ref(false);
const joinPreview = ref(null);
const joinError = ref("");

function extractShareCode(input) {
  const trimmed = input.trim();
  // If it looks like a URL, extract the code from ?share=
  const match = trimmed.match(/[?&]share=([^&]+)/);
  if (match) return match[1];
  // Otherwise treat the whole input as the code
  return trimmed;
}

async function verifyShareCode() {
  const code = extractShareCode(shareCode.code);
  if (!code) return;
  joinLoading.value = true;
  joinError.value = "";
  joinPreview.value = null;
  try {
    const data = await sharesApi.verifyShareCode(code);
    joinPreview.value = { ...data, code };
    showJoinModal.value = true;
  } catch (e) {
    joinError.value = e.message || "Invalid or expired share code";
  }
  joinLoading.value = false;
}

async function confirmJoinShare() {
  if (!joinPreview.value?.code) return;
  joinLoading.value = true;
  try {
    await appStore.acceptShare(joinPreview.value.code);
    shareCode.code = "";
    joinPreview.value = null;
    showJoinModal.value = false;
  } catch (e) {
    toastStore.error(e.message || "Failed to join");
  }
  joinLoading.value = false;
}

function cancelJoinShare() {
  showJoinModal.value = false;
  joinPreview.value = null;
  joinError.value = "";
}

const showImportExport = ref(false);
const showDangerZone = ref(false);
const showDeleteProgress = ref(false);
const deleteProgress = ref("");
const deleteProgressPercent = ref(0);

// Delete Everything confirmation modal
const showDeleteModal = ref(false);
const deleteConfirmInput = ref("");

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

function openDeleteEverythingModal() {
  deleteConfirmInput.value = "";
  showDeleteModal.value = true;
}

async function confirmDeleteEverything() {
  const totalCount =
    appStore.total + appStore.categories.length + appStore.tags.length;
  const expectedAnswer = `delete ${totalCount} now`;

  if (deleteConfirmInput.value !== expectedAnswer) {
    toastStore.error("Confirmation failed. Please type the exact phrase.");
    return;
  }

  showDeleteModal.value = false;

  showDeleteProgress.value = true;
  deleteProgress.value = "Deleting all data...";
  deleteProgressPercent.value = 30;

  try {
    const result = await accountApi.deleteAllData();

    deleteProgress.value = "Refreshing data...";
    deleteProgressPercent.value = 80;

    await appStore.loadLinks({ reset: true });
    await appStore.loadCategories();
    await appStore.loadTags();

    deleteProgressPercent.value = 100;
    deleteProgress.value = "Complete!";

    setTimeout(() => {
      showDeleteProgress.value = false;
      const d = result.deleted;
      toastStore.success(
        `Deleted ${d.links_deleted} links, ${d.tags_deleted} tags, ${d.categories_deleted} categories`,
      );
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
      <form class="flex gap-2" @submit.prevent="verifyShareCode">
        <input
          v-model="shareCode.code"
          placeholder="Share code or URL"
          class="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        />
        <button
          class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1"
          :disabled="joinLoading"
        >
          <i v-if="joinLoading" class="mdi mdi-loading mdi-spin"></i>
          Verify
        </button>
      </form>
      <p v-if="joinError" class="text-sm text-red-600 dark:text-red-400">
        {{ joinError }}
      </p>

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
          class="mdi text-red-600 dark:text-red-400 transition-transform duration-200"
          :class="showDangerZone ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        ></i>
      </button>

      <transition
        enter-active-class="transition-all duration-200 ease-out overflow-hidden"
        leave-active-class="transition-all duration-200 ease-in overflow-hidden"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-40 opacity-100"
        leave-from-class="max-h-40 opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div v-if="showDangerZone" class="mt-4">
          <p class="text-sm text-gray-600 dark:text-brand-400 mb-4">
            These actions are irreversible. Please be certain before proceeding.
          </p>
          <button
            class="w-full px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
            @click="openDeleteEverythingModal"
          >
            Delete Everything
          </button>
        </div>
      </transition>
    </article>

    <!-- App Version -->
    <p
      v-if="appStore.appConfig.app_version"
      class="text-center text-xs text-gray-400 dark:text-brand-600"
    >
      {{ appStore.appConfig.site_name }} v{{ appStore.appConfig.app_version }}
    </p>

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

    <!-- Join Share Preview Modal -->
    <Teleport to="body">
      <div
        v-if="showJoinModal && joinPreview"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
        @click.self="cancelJoinShare"
      >
        <div
          class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-sm w-full p-6"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Join Shared Category
          </h3>
          <div
            class="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-brand-800 rounded-md"
          >
            <i
              :class="joinPreview.icon || 'mdi-folder'"
              class="mdi text-2xl"
              :style="`color: ${joinPreview.color || '#6B7280'}`"
            ></i>
            <div>
              <p class="font-semibold text-gray-900 dark:text-white">
                {{ joinPreview.category_name }}
              </p>
              <p class="text-xs text-gray-500 dark:text-brand-400">
                Shared by {{ joinPreview.owner_email }} ·
                {{ joinPreview.link_count }} links
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button
              class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700"
              @click="cancelJoinShare"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1"
              :disabled="joinLoading"
              @click="confirmJoinShare"
            >
              <i v-if="joinLoading" class="mdi mdi-loading mdi-spin"></i>
              Join
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Everything Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
        @click.self="showDeleteModal = false"
      >
        <div
          class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-md w-full p-6"
        >
          <h3 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
            Delete Everything
          </h3>
          <p class="text-sm text-gray-600 dark:text-brand-300 mb-3">
            This will permanently delete ALL your data:
          </p>
          <ul class="text-sm text-gray-600 dark:text-brand-300 mb-4 space-y-1">
            <li>• All links ({{ appStore.total }})</li>
            <li>• All categories ({{ appStore.categories.length }})</li>
            <li>• All tags ({{ appStore.tags.length }})</li>
          </ul>
          <p class="text-sm text-gray-600 dark:text-brand-300 mb-2">
            Type
            <strong class="text-gray-900 dark:text-white"
              >delete
              {{
                appStore.total +
                appStore.categories.length +
                appStore.tags.length
              }}
              now</strong
            >
            to confirm:
          </p>
          <input
            v-model="deleteConfirmInput"
            class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800 mb-4"
            placeholder="Type the confirmation phrase..."
          />
          <div class="flex justify-end gap-2">
            <button
              class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700"
              @click="showDeleteModal = false"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
              @click="confirmDeleteEverything"
            >
              Delete Everything
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
