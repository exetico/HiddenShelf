<script setup>
import { appUrl } from "@/lib/appUrl";
import { bookmarkletHref } from "@/lib/quickAdd";
import { ref, reactive, onMounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { useDialogStore } from "@/stores/dialog";
import { sharesApi } from "@/services/api/sharesApi";
import { accountApi } from "@/services/api/accountApi";
import ImportExportModal from "@/components/common/ImportExportModal.vue";
import { backdropClose } from "@/lib/backdropClose";

const authStore = useAuthStore();
const appStore = useAppStore();
const toastStore = useToastStore();

// Bookmarklets only work from the bookmarks bar; clicking it here would
// just add this page
const bookmarklet = bookmarkletHref(appUrl("/edit?new=1"));
function onBookmarkletClick() {
  toastStore.success("Drag the button to your bookmarks bar, then click it on any page.");
}

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

// Categories I share with others
const ownedShares = ref([]);
const dialog = useDialogStore();

async function loadOwnedShares() {
  try {
    ownedShares.value = await sharesApi.listOwnedShares();
  } catch {
    ownedShares.value = [];
  }
}

const route = useRoute();
const sharingSection = ref(null);

onMounted(async () => {
  // The dashboard's Sharing card links here with ?section=sharing
  if (route.query.section === "sharing") {
    await nextTick();
    sharingSection.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // ...and its Import / export button with ?section=data
  if (route.query.section === "data") showImportExport.value = true;
  await loadOwnedShares();
});

async function leaveShared(category) {
  const ok = await dialog.confirm({
    title: `Leave "${category.name}"?`,
    message: "Its links disappear from your shelf until you join again.",
    confirmText: "Leave",
    danger: true,
    icon: "mdi-exit-run",
  });
  if (ok) await appStore.leaveSharedCategory(category.id);
}

// Links work once, so fetch the current one: it changes when someone joins
async function copyOwnedShareUrl(share) {
  try {
    const { share: current } = await sharesApi.getCategoryShare(share.id);
    if (current?.share_code) share.share_code = current.share_code;
  } catch {
    // Copy the one we have
  }
  await navigator.clipboard.writeText(
    appUrl(`/login?share=${share.share_code}`),
  );
  toastStore.success("Share URL copied. It works for one person.");
}

async function removeOwnedMember(share, member) {
  const ok = await dialog.confirm({
    title: `Remove ${member.email}?`,
    message: `They lose access to "${share.name}". To let them back in, send them a new share link.`,
    confirmText: "Remove",
    danger: true,
    icon: "mdi-account-remove-outline",
  });
  if (!ok) return;
  try {
    await sharesApi.removeMember(share.id, member.id);
    share.members = share.members.filter((m) => m.id !== member.id);
    toastStore.success(`Removed ${member.email}`);
  } catch (e) {
    toastStore.error(e.message || "Failed to remove member");
  }
}

async function stopSharing(share) {
  const ok = await dialog.confirm({
    title: `Stop sharing "${share.name}"?`,
    message: "Everyone who joined loses access, and the share link stops working.",
    confirmText: "Stop sharing",
    danger: true,
    icon: "mdi-link-variant-off",
  });
  if (!ok) return;
  try {
    await sharesApi.removeSharing(share.id);
    ownedShares.value = ownedShares.value.filter((s) => s.id !== share.id);
    await appStore.loadCategories();
    toastStore.success(`Stopped sharing ${share.name}`);
  } catch (e) {
    toastStore.error(e.message || "Failed to stop sharing");
  }
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

// Closes on a backdrop click, but not when a text selection ends there
const joinBackdrop = backdropClose(() => cancelJoinShare());
const deleteBackdrop = backdropClose(() => (showDeleteModal.value = false));
</script>

<template>
  <section class="max-w-3xl space-y-6" data-testid="profile-page">
    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
    >
      <h1 class="text-2xl font-bold">Profile</h1>
      <p class="text-gray-600 dark:text-brand-300 mt-1">
        {{ authStore.user?.email }}
      </p>
    </article>

    <!-- Beta / Data Retention Notice -->
    <article
      class="bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800 p-4"
    >
      <p class="text-sm text-amber-800 dark:text-amber-300">
        <i class="mdi mdi-information-outline mr-1"></i>
        <strong>Beta notice:</strong> Hidden Shelf is currently in beta. Data
        may be reset or deleted without prior notice. Please
        <button
          title="Open import and export"
          class="underline hover:no-underline font-medium"
          @click="showImportExport = true"
        >
          export your data
        </button>
        regularly as a backup.
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
          title="Use the default brand color"
          class="text-xs text-gray-500 dark:text-brand-400 hover:text-gray-700 dark:hover:text-brand-200"
          @click="resetBrandColor"
        >
          Reset to default
        </button>
      </div>

      <button
        title="Save your settings"
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="saveSettings"
      >
        Save settings
      </button>
    </article>

    <!-- Bookmarklet: save the page you're on, from any site -->
    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5 space-y-3"
      data-testid="quick-add"
    >
      <h2 class="text-lg font-semibold">Save links from anywhere</h2>
      <p class="text-sm text-gray-600 dark:text-brand-400">
        Drag this button to your bookmarks bar. On any page, click it to add
        that page here, with its address and title filled in. Press
        <kbd class="px-1.5 rounded border border-gray-300 dark:border-brand-600 text-xs font-sans">N</kbd>
        in the app to add a link by hand.
      </p>
      <a
        :href="bookmarklet"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border-2 border-dashed border-brand-400 text-brand-700 dark:text-brand-200 cursor-grab"
        title="Drag me to your bookmarks bar"
        data-testid="bookmarklet"
        @click.prevent="onBookmarkletClick"
      >
        <i class="mdi mdi-bookmark-plus-outline" aria-hidden="true"></i>
        Save to {{ appStore.appConfig.site_name || "Hidden Shelf" }}
      </a>
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
        title="Import or export your data"
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
      id="sharing"
      ref="sharingSection"
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5 space-y-3 scroll-mt-16 sm:scroll-mt-20"
    >
      <h2 class="text-lg font-semibold">Shared categories</h2>
      <p class="text-sm text-gray-500 dark:text-brand-400">
        Share a category to let other Hidden Shelf users see its links
        (read-only). Here you can see everything you share and everything
        shared with you, and take access back at any time.
      </p>

      <!-- Shared by you -->
      <section class="space-y-2">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-brand-300">
          Shared by you
        </h3>
        <p
          v-if="!ownedShares.length"
          class="text-xs text-gray-500 dark:text-brand-400"
        >
          You aren't sharing any categories. To share one, go to Edit, open
          Categories and tap the
          <i class="mdi mdi-share-variant text-blue-600 dark:text-blue-400"></i>
          share icon next to it.
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="share in ownedShares"
            :key="share.id"
            class="border border-gray-200 dark:border-brand-800 rounded-md p-2 space-y-2"
          >
            <div class="flex items-center gap-2">
              <i
                :class="share.icon || 'mdi-folder'"
                class="mdi text-lg shrink-0"
                :style="`color: ${share.color || '#6B7280'}`"
              ></i>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ share.name }}</p>
                <p class="text-xs text-gray-500 dark:text-brand-400">
                  {{ share.members.length }}
                  {{ share.members.length === 1 ? "person" : "people" }} joined
                </p>
              </div>
              <button
                class="p-1.5 text-brand-600 dark:text-brand-300 shrink-0"
                title="Copy share link"
                :aria-label="`Copy share link for ${share.name}`"
                @click="copyOwnedShareUrl(share)"
              >
                <i class="mdi mdi-content-copy"></i>
              </button>
              <button
                :title="`Stop sharing ${share.name}; people who joined lose access`"
                class="text-sm text-red-600 dark:text-red-400 shrink-0"
                @click="stopSharing(share)"
              >
                Stop sharing
              </button>
            </div>
            <ul v-if="share.members.length" class="pl-7 space-y-1">
              <li
                v-for="member in share.members"
                :key="member.id"
                class="flex items-center justify-between gap-2 text-sm"
              >
                <span class="truncate text-gray-700 dark:text-brand-200">{{
                  member.email
                }}</span>
                <button
                  :title="`Remove ${member.email} from ${share.name}`"
                  class="text-xs text-red-600 dark:text-red-400 shrink-0"
                  @click="removeOwnedMember(share, member)"
                >
                  Remove
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <!-- Shared with you -->
      <section
        class="space-y-2 pt-3 border-t border-gray-200 dark:border-brand-800"
      >
        <h3 class="text-sm font-semibold text-gray-700 dark:text-brand-300">
          Shared with you
        </h3>
        <p class="text-xs text-gray-500 dark:text-brand-400">
          Got a share code or URL from someone? Paste it here and press Verify
          to preview the category before joining. Joined categories show up in
          your View page marked "shared by".
        </p>
        <form class="flex gap-2" @submit.prevent="verifyShareCode">
          <input
            v-model="shareCode.code"
            placeholder="Share code or URL"
            aria-label="Share code or URL"
            class="flex-1 min-w-0 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
          />
          <button
            title="Check the share code"
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
              :title="`Leave ${category.name}`"
              class="text-red-600 dark:text-red-400 text-sm"
              @click="leaveShared(category)"
            >
              Leave
            </button>
          </li>
        </ul>
      </section>
    </article>

    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
    >
      <button
        title="Sign out on this device"
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
        title="Show or hide dangerous actions"
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
            title="Delete all your links, categories and tags"
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
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4"
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
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4"
        v-on="joinBackdrop"
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
              title="Cancel"
              class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700"
              @click="cancelJoinShare"
            >
              Cancel
            </button>
            <button
              title="Join this shared category"
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
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4"
        v-on="deleteBackdrop"
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
              title="Keep my data"
              class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700"
              @click="showDeleteModal = false"
            >
              Cancel
            </button>
            <button
              title="Delete everything for good"
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
