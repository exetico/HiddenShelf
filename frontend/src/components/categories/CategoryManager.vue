<script setup>
import { appUrl } from "@/lib/appUrl";
import { ref, reactive } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";
import { sharesApi } from "@/services/api/sharesApi";
import { useToastStore } from "@/stores/toast";
import { useAppStore } from "@/stores/app";
import { useDialogStore } from "@/stores/dialog";

const props = defineProps({
  open: Boolean,
  categories: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "create", "update", "remove"]);

const toastStore = useToastStore();
const appStore = useAppStore();

const name = ref("");
const icon = ref("mdi-folder");
const color = ref("#687061");
const directRedirectDefault = ref(false);
const showCreateForm = ref(false);

// Edit state
const editingId = ref(null);
const editForm = reactive({
  name: "",
  icon: "",
  color: "#687061",
  direct_redirect_default: false,
});

// Share state
const showShareModal = ref(false);
const shareCategory = ref(null);
const shareData = ref(null);
const shareMembers = ref([]);
const shareLoading = ref(false);


function createCategory() {
  if (!name.value.trim()) return;
  emit("create", {
    name: name.value,
    icon: icon.value,
    color: color.value,
    direct_redirect_default: directRedirectDefault.value ? 1 : 0,
  });
  name.value = "";
  icon.value = "mdi-folder";
  color.value = "#687061";
  directRedirectDefault.value = false;
  showCreateForm.value = false;
}

function startEdit(category) {
  editingId.value = category.id;
  editForm.name = category.name;
  editForm.icon = category.icon || "mdi-folder";
  editForm.color = category.color || "#687061";
  editForm.direct_redirect_default = Boolean(category.direct_redirect_default);
}

function cancelEdit() {
  editingId.value = null;
}

function saveEdit(id) {
  emit("update", id, {
    name: editForm.name,
    icon: editForm.icon,
    color: editForm.color,
    direct_redirect_default: editForm.direct_redirect_default ? 1 : 0,
  });
  editingId.value = null;
}

async function promptDelete(category) {
  const ok = await useDialogStore().confirmDelete({
    title: `Delete category "${category.name}"?`,
    message:
      "Its links stay on your shelf as uncategorized. This can't be undone.",
  });
  if (ok) emit("remove", category.id);
}

async function leaveShared(category) {
  const ok = await useDialogStore().confirm({
    title: `Leave "${category.name}"?`,
    message: "Its links disappear from your shelf until you join again.",
    confirmText: "Leave",
    danger: true,
    icon: "mdi-exit-run",
  });
  if (ok) await appStore.leaveSharedCategory(category.id);
}

async function openShare(category) {
  shareCategory.value = category;
  shareData.value = null;
  shareMembers.value = [];
  shareLoading.value = true;
  showShareModal.value = true;

  try {
    const data = await sharesApi.getCategoryShare(category.id);
    shareData.value = data.share;
    shareMembers.value = data.members || [];
  } catch {
    // No share exists yet — that's OK, user can create one
    shareData.value = null;
  }
  shareLoading.value = false;
}

async function createShare() {
  if (!shareCategory.value) return;
  shareLoading.value = true;
  try {
    const share = await sharesApi.createCategoryShare(shareCategory.value.id);
    shareData.value = share;
    toastStore.success("Share link created");
  } catch (e) {
    toastStore.error(e.message || "Failed to create share");
  }
  shareLoading.value = false;
}

function getShareUrl() {
  if (!shareData.value?.share_code) return "";
  return appUrl(`/login?share=${shareData.value.share_code}`);
}

async function copyShareUrl() {
  await navigator.clipboard.writeText(getShareUrl());
  toastStore.success("Share URL copied");
}

async function copyShareCode() {
  await navigator.clipboard.writeText(shareData.value.share_code);
  toastStore.success("Share code copied");
}

async function resetShare() {
  if (!shareCategory.value) return;
  try {
    shareData.value = await sharesApi.resetShareCode(shareCategory.value.id);
    toastStore.success("New share link made; the old one no longer works");
  } catch (e) {
    toastStore.error(e.message || "Failed to make a new link");
  }
}

async function removeMember(memberId) {
  if (!shareCategory.value) return;
  try {
    await sharesApi.removeMember(shareCategory.value.id, memberId);
    shareMembers.value = shareMembers.value.filter((m) => m.id !== memberId);
    toastStore.success("Member removed");
  } catch (e) {
    toastStore.error(e.message || "Failed to remove member");
  }
}

async function removeSharing() {
  if (!shareCategory.value) return;
  const ok = await useDialogStore().confirm({
    title: `Stop sharing "${shareCategory.value.name}"?`,
    message: "Everyone who joined loses access, and the share link stops working.",
    confirmText: "Stop sharing",
    danger: true,
    icon: "mdi-link-variant-off",
  });
  if (!ok) return;
  try {
    await sharesApi.removeSharing(shareCategory.value.id);
    shareData.value = null;
    shareMembers.value = [];
    toastStore.success("Sharing removed");
  } catch (e) {
    toastStore.error(e.message || "Failed to remove sharing");
  }
}
</script>

<template>
  <BaseModal :open="open" title="Categories" @close="emit('close')">
    <div class="space-y-4">
      <!-- Add Category toggle button -->
      <button
        title="Create a new category"
        v-if="!showCreateForm"
        class="w-full px-3 py-2 rounded-md border-2 border-dashed border-gray-300 dark:border-brand-700 text-gray-600 dark:text-brand-400 hover:border-brand-500 hover:text-brand-600 dark:hover:border-brand-500 dark:hover:text-brand-300 transition-colors flex items-center justify-center gap-2"
        @click="showCreateForm = true"
      >
        <i class="mdi mdi-plus"></i>
        Add category
      </button>

      <!-- Create form (hidden by default) -->
      <form
        v-if="showCreateForm"
        class="space-y-2"
        @submit.prevent="createCategory"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            v-model="name"
            placeholder="Category name"
            class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
          />
          <input
            v-model="icon"
            placeholder="Icon (e.g. mdi-folder)"
            class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
          />
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <input
              v-model="color"
              type="color"
              class="h-10 w-16 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800 cursor-pointer"
            />
            <!-- Live icon preview -->
            <i
              :class="icon || 'mdi-folder'"
              class="mdi text-2xl"
              :style="`color: ${color}`"
            ></i>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="directRedirectDefault" type="checkbox" />
            Direct redirect default
          </label>
        </div>
        <div class="flex items-center gap-2">
          <button
            title="Create this category"
            class="px-3 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
          >
            Create category
          </button>
          <button
            title="Cancel without creating"
            type="button"
            class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 text-gray-600 dark:text-brand-400 hover:bg-gray-100 dark:hover:bg-brand-800"
            @click="showCreateForm = false"
          >
            Cancel
          </button>
          <a
            title="Find icon names on pictogrammers.com (opens in a new tab)"
            href="https://pictogrammers.com/library/mdi/"
            target="_blank"
            class="text-xs text-brand-600 dark:text-brand-400 hover:underline"
          >
            Browse icons →
          </a>
        </div>
      </form>

      <!-- Category list -->
      <p
        v-if="categories.length > 1"
        class="text-xs text-gray-500 dark:text-brand-400"
      >
        Use the arrows to set the order and the star to pin favorites to the
        top of the View page.
      </p>
      <ul class="space-y-2 max-h-[50dvh] overflow-auto">
        <li
          v-for="(category, index) in categories"
          :key="category.id"
          class="border border-gray-200 dark:border-brand-800 rounded-md p-3"
        >
          <!-- View mode -->
          <div
            v-if="editingId !== category.id"
            class="flex items-center justify-between gap-2"
          >
            <div class="flex items-center gap-2 min-w-0">
              <div class="flex flex-col -my-1 shrink-0">
                <button
                  class="text-gray-400 hover:text-gray-700 dark:text-brand-500 dark:hover:text-brand-200 disabled:opacity-30 leading-none"
                  :disabled="index === 0"
                  title="Move up"
                  :aria-label="`Move ${category.name} up`"
                  @click="appStore.moveCategory(category, 'up')"
                >
                  <i class="mdi mdi-chevron-up text-lg"></i>
                </button>
                <button
                  class="text-gray-400 hover:text-gray-700 dark:text-brand-500 dark:hover:text-brand-200 disabled:opacity-30 leading-none"
                  :disabled="index === categories.length - 1"
                  title="Move down"
                  :aria-label="`Move ${category.name} down`"
                  @click="appStore.moveCategory(category, 'down')"
                >
                  <i class="mdi mdi-chevron-down text-lg"></i>
                </button>
              </div>
              <i
                :class="category.icon || 'mdi-folder'"
                class="mdi text-lg"
                :style="`color: ${category.color || '#6B7280'}`"
              ></i>
              <div class="min-w-0">
                <p class="font-medium truncate">{{ category.name }}</p>
                <p class="text-xs text-gray-500 dark:text-brand-400">
                  {{ category.link_count || 0 }} links
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3 text-sm shrink-0">
              <button
                :class="
                  category.is_favorite
                    ? 'text-amber-500'
                    : 'text-gray-400 dark:text-brand-500'
                "
                :title="category.is_favorite ? 'Unfavorite' : 'Favorite'"
                :aria-label="
                  category.is_favorite
                    ? `Remove ${category.name} from favorites`
                    : `Add ${category.name} to favorites`
                "
                @click="appStore.toggleFavorite(category)"
              >
                <i
                  class="mdi text-base"
                  :class="category.is_favorite ? 'mdi-star' : 'mdi-star-outline'"
                ></i>
              </button>
              <button
                class="text-blue-600 dark:text-blue-400"
                title="Share"
                @click="openShare(category)"
              >
                <i class="mdi mdi-share-variant"></i>
              </button>
              <button
                :title="`Edit ${category.name}`"
                class="text-brand-600 dark:text-brand-400"
                @click="startEdit(category)"
              >
                Edit
              </button>
              <button
                :title="`Delete ${category.name}`"
                class="text-red-600 dark:text-red-400"
                @click="promptDelete(category)"
              >
                Delete
              </button>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-else class="space-y-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                v-model="editForm.name"
                class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
              />
              <input
                v-model="editForm.icon"
                placeholder="Icon"
                class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
              />
            </div>
            <div class="flex items-center gap-3">
              <input
                v-model="editForm.color"
                type="color"
                class="h-10 w-16 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800 cursor-pointer"
              />
              <i
                :class="editForm.icon || 'mdi-folder'"
                class="mdi text-2xl"
                :style="`color: ${editForm.color}`"
              ></i>
              <label class="flex items-center gap-2 text-sm">
                <input
                  v-model="editForm.direct_redirect_default"
                  type="checkbox"
                />
                Direct redirect
              </label>
            </div>
            <div class="flex gap-2">
              <button
                title="Save changes"
                class="px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 text-sm"
                @click="saveEdit(category.id)"
              >
                Save
              </button>
              <button
                title="Discard changes"
                class="px-3 py-1.5 rounded-md border border-gray-300 dark:border-brand-700 text-sm"
                @click="cancelEdit"
              >
                Cancel
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Shared with me -->
    <div
      v-if="appStore.sharedCategories.length"
      class="pt-4 border-t border-gray-200 dark:border-brand-800"
    >
      <h3 class="text-sm font-semibold text-gray-700 dark:text-brand-300 mb-2">
        Shared with me
      </h3>
      <ul class="space-y-2">
        <li
          v-for="category in appStore.sharedCategories"
          :key="category.id"
          class="border border-gray-200 dark:border-brand-800 rounded-md p-3 flex items-center justify-between"
        >
          <div class="flex items-center gap-2 min-w-0">
            <i
              :class="category.icon || 'mdi-folder'"
              class="mdi text-lg"
              :style="`color: ${category.color || '#6B7280'}`"
            ></i>
            <div class="min-w-0">
              <p class="font-medium truncate">{{ category.name }}</p>
              <p class="text-xs text-gray-500 dark:text-brand-400">
                Shared by {{ category.owner_email }}
              </p>
            </div>
          </div>
          <button
            :title="`Leave ${category.name}; you will no longer see its links`"
            class="text-red-600 dark:text-red-400 text-sm hover:text-red-800"
            @click="leaveShared(category)"
          >
            Leave
          </button>
        </li>
      </ul>
    </div>
  </BaseModal>

  <!-- Share Modal -->
  <Teleport to="body">
    <div
      v-if="showShareModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-70 p-4"
      @click.self="showShareModal = false"
    >
      <div
        class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Share "{{ shareCategory?.name }}"
        </h3>

        <div v-if="shareLoading" class="text-center py-4">
          <i class="mdi mdi-loading mdi-spin text-2xl text-brand-600"></i>
        </div>

        <div v-else-if="shareData">
          <p class="text-sm text-gray-600 dark:text-brand-300 mb-3">
            Send this link to one person to give them read-only access:
          </p>
          <p
            class="text-xs text-gray-500 dark:text-brand-400 mb-3"
            data-testid="share-single-use"
          >
            <i class="mdi mdi-shield-check-outline"></i>
            It works once. When someone joins, it stops working and a new link
            shows up here for the next person.
          </p>
          <div
            class="flex items-center gap-2 bg-gray-50 dark:bg-brand-800 rounded-md p-3 mb-4"
          >
            <input
              :value="getShareUrl()"
              readonly
              class="flex-1 bg-transparent text-xs font-mono truncate border-none outline-hidden"
              @focus="$event.target.select()"
            />
            <button
              title="Copy the share link"
              class="px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700 shrink-0"
              @click="copyShareUrl"
            >
              Copy
            </button>
          </div>

          <p class="text-sm text-gray-600 dark:text-brand-300 mb-3">
            Or share the code:
          </p>
          <div
            class="flex items-center gap-2 bg-gray-50 dark:bg-brand-800 rounded-md p-3 mb-4"
          >
            <code class="flex-1 text-sm font-mono truncate select-all">{{
              shareData.share_code
            }}</code>
            <button
              title="Copy the share code"
              class="px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700 shrink-0"
              @click="copyShareCode"
            >
              Copy
            </button>
          </div>

          <div v-if="shareMembers.length" class="mb-4">
            <p
              class="text-sm font-medium text-gray-700 dark:text-brand-300 mb-2"
            >
              Members ({{ shareMembers.length }}):
            </p>
            <ul class="space-y-1">
              <li
                v-for="member in shareMembers"
                :key="member.id"
                class="text-sm text-gray-600 dark:text-brand-400 flex items-center justify-between"
              >
                <span class="flex items-center gap-2">
                  <i class="mdi mdi-account text-brand-500"></i>
                  {{ member.email }}
                </span>
                <button
                  class="text-red-500 hover:text-red-700 text-xs"
                  title="Remove member"
                  @click="removeMember(member.id)"
                >
                  <i class="mdi mdi-close"></i>
                </button>
              </li>
            </ul>
          </div>

          <!-- New link / remove sharing -->
          <div class="mb-2 flex flex-col gap-2">
            <button
              title="Make a new link; the current one stops working"
              class="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700 text-sm hover:bg-gray-50 dark:hover:bg-brand-800"
              data-testid="reset-share"
              @click="resetShare"
            >
              <i class="mdi mdi-refresh"></i>
              New link
            </button>
            <button
              title="Stop sharing this category"
              class="w-full px-4 py-2 rounded-md border border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 text-sm"
              @click="removeSharing"
            >
              Remove Sharing
            </button>
          </div>
        </div>

        <div v-else>
          <p class="text-sm text-gray-600 dark:text-brand-300 mb-4">
            This category is not shared yet. Create a share link to let others
            view its links.
          </p>
          <button
            title="Create a link others can use to join"
            class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
            @click="createShare"
          >
            Create Share Link
          </button>
        </div>

        <div class="flex justify-end mt-4">
          <button
            title="Close"
            class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700"
            @click="showShareModal = false"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
