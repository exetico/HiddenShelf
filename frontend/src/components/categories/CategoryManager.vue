<script setup>
import { ref, reactive } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";
import { sharesApi } from "@/services/api/sharesApi";
import { useToastStore } from "@/stores/toast";
import { useAppStore } from "@/stores/app";

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

// Delete confirmation state
const showDeleteModal = ref(false);
const deleteTarget = ref(null);

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

function promptDelete(category) {
  deleteTarget.value = { id: category.id, name: category.name };
  showDeleteModal.value = true;
}

function confirmDelete() {
  emit("remove", deleteTarget.value.id);
  showDeleteModal.value = false;
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
  return `${window.location.origin}/public/app/index.html#/login?share=${shareData.value.share_code}`;
}

async function copyShareUrl() {
  await navigator.clipboard.writeText(getShareUrl());
  toastStore.success("Share URL copied");
}

async function copyShareCode() {
  await navigator.clipboard.writeText(shareData.value.share_code);
  toastStore.success("Share code copied");
}

const showRemoveSharingConfirm = ref(false);

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
  try {
    await sharesApi.removeSharing(shareCategory.value.id);
    shareData.value = null;
    shareMembers.value = [];
    showRemoveSharingConfirm.value = false;
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
            class="px-3 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
          >
            Create category
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 text-gray-600 dark:text-brand-400 hover:bg-gray-100 dark:hover:bg-brand-800"
            @click="showCreateForm = false"
          >
            Cancel
          </button>
          <a
            href="https://pictogrammers.com/library/mdi/"
            target="_blank"
            class="text-xs text-brand-600 dark:text-brand-400 hover:underline"
          >
            Browse icons →
          </a>
        </div>
      </form>

      <!-- Category list -->
      <ul class="space-y-2 max-h-64 overflow-auto">
        <li
          v-for="category in categories"
          :key="category.id"
          class="border border-gray-200 dark:border-brand-800 rounded-md p-3"
        >
          <!-- View mode -->
          <div
            v-if="editingId !== category.id"
            class="flex items-center justify-between"
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
                  {{ category.link_count || 0 }} links
                </p>
              </div>
            </div>
            <div class="flex gap-2 text-sm">
              <button
                class="text-blue-600 dark:text-blue-400"
                title="Share"
                @click="openShare(category)"
              >
                <i class="mdi mdi-share-variant"></i>
              </button>
              <button
                class="text-brand-600 dark:text-brand-400"
                @click="startEdit(category)"
              >
                Edit
              </button>
              <button
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
                class="px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 text-sm"
                @click="saveEdit(category.id)"
              >
                Save
              </button>
              <button
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
            class="text-red-600 dark:text-red-400 text-sm hover:text-red-800"
            @click="appStore.leaveSharedCategory(category.id)"
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
            Share this URL with others to give them read-only access:
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

          <!-- Remove sharing -->
          <div v-if="!showRemoveSharingConfirm" class="mb-2">
            <button
              class="w-full px-4 py-2 rounded-md border border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 text-sm"
              @click="showRemoveSharingConfirm = true"
            >
              Remove Sharing
            </button>
          </div>
          <div v-else class="mb-2 space-y-2">
            <p class="text-sm text-red-600 dark:text-red-400">
              This will revoke access for all members. Are you sure?
            </p>
            <div class="flex gap-2">
              <button
                class="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm"
                @click="removeSharing"
              >
                Yes, remove sharing
              </button>
              <button
                class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700 text-sm"
                @click="showRemoveSharingConfirm = false"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div v-else>
          <p class="text-sm text-gray-600 dark:text-brand-300 mb-4">
            This category is not shared yet. Create a share link to let others
            view its links.
          </p>
          <button
            class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
            @click="createShare"
          >
            Create Share Link
          </button>
        </div>

        <div class="flex justify-end mt-4">
          <button
            class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700"
            @click="showShareModal = false"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Delete Confirmation Modal -->
  <Teleport to="body">
    <div
      v-if="showDeleteModal && deleteTarget"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-70 p-4"
      @click.self="showDeleteModal = false"
    >
      <div
        class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-sm w-full p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Delete Category
        </h3>
        <p class="text-gray-600 dark:text-brand-300 mb-4">
          Are you sure you want to delete
          <strong class="text-gray-900 dark:text-white">{{
            deleteTarget.name
          }}</strong
          >? Links in this category will become uncategorized.
        </p>
        <div class="flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700"
            @click="showDeleteModal = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
            @click="confirmDelete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
