<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";

const props = defineProps({
  open: Boolean,
  link: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["close"]);

const router = useRouter();
const appStore = useAppStore();
const toastStore = useToastStore();

// Position modal — store link id separately so it survives parent close
const showPositionModal = ref(false);
const positionInput = ref("");
const positionLinkId = ref(null);

// Delete confirmation modal
const showDeleteModal = ref(false);
const deleteLinkData = ref(null);

// Prevent closing on immediate mouseup after opening
let justOpened = false;

function onOpen() {
  justOpened = true;
  setTimeout(() => {
    justOpened = false;
  }, 200);
}

function close() {
  if (justOpened) return;
  emit("close");
}

function openInCurrentTab() {
  if (props.link?.url) {
    window.location.href = props.link.url;
  }
  emit("close");
}

function openInNewTab() {
  if (props.link?.url) {
    window.open(props.link.url, "_blank");
  }
  emit("close");
}

function editLink() {
  if (props.link) {
    router.push({ name: "edit", query: { editId: props.link.id } });
  }
  emit("close");
}

function setPosition() {
  if (props.link) {
    positionLinkId.value = props.link.id;
    positionInput.value = props.link.display_order || "";
    showPositionModal.value = true;
  }
  emit("close");
}

async function resetPosition() {
  if (props.link) {
    try {
      await appStore.updateLink(props.link.id, { display_order: 0 });
      toastStore.success("Position reset");
    } catch {
      toastStore.error("Failed to reset position");
    }
  }
  emit("close");
}

async function savePosition() {
  if (!positionInput.value && positionInput.value !== 0) return;
  try {
    await appStore.updateLink(positionLinkId.value, {
      display_order: Number(positionInput.value),
    });
    toastStore.success("Position updated");
  } catch {
    toastStore.error("Failed to update position");
  }
  showPositionModal.value = false;
}

function deleteLink() {
  if (props.link) {
    deleteLinkData.value = { id: props.link.id, title: props.link.title };
    showDeleteModal.value = true;
  }
  emit("close");
}

async function confirmDelete() {
  try {
    await appStore.deleteLink(deleteLinkData.value.id);
  } catch {
    // error handled by store
  }
  showDeleteModal.value = false;
}

// Watch for open prop to trigger onOpen
import { watch } from "vue";
watch(
  () => props.open,
  (val) => {
    if (val) onOpen();
  },
);
</script>

<template>
  <!-- Context Menu Modal -->
  <Teleport to="body">
    <div
      v-if="open && link"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      @click.self="close"
    >
      <div
        class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-md w-full transition-colors"
      >
        <div class="p-6">
          <div class="mb-4">
            <p class="text-sm text-gray-600 dark:text-brand-400 mb-1">
              Quick actions for:
            </p>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ link.title }}
            </h3>
          </div>

          <div class="flex flex-col gap-2">
            <!-- Navigation Options -->
            <div class="flex gap-2">
              <button
                class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                @click="openInCurrentTab"
              >
                <i class="mdi mdi-arrow-right"></i>
                <span>Open Link</span>
              </button>

              <button
                class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                @click="openInNewTab"
              >
                <i class="mdi mdi-open-in-new"></i>
                <span>New Tab</span>
              </button>
            </div>

            <button
              v-if="!link.is_from_shared_category"
              class="w-full px-4 py-3 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
              @click="editLink"
            >
              <i class="mdi mdi-pencil"></i>
              <span>Edit</span>
            </button>

            <div v-if="!link.is_from_shared_category" class="flex gap-2">
              <button
                class="flex-1 px-4 py-3 bg-gray-600 dark:bg-brand-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
                @click="setPosition"
              >
                <i class="mdi mdi-sort-numeric-variant"></i>
                <span>Set Position</span>
              </button>
              <button
                class="flex-1 px-4 py-3 bg-gray-500 dark:bg-brand-800 text-white rounded-md hover:bg-gray-600 dark:hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
                @click="resetPosition"
              >
                <i class="mdi mdi-sort-variant-remove"></i>
                <span>Reset Position</span>
              </button>
            </div>

            <button
              v-if="!link.is_from_shared_category"
              class="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              @click="deleteLink"
            >
              <i class="mdi mdi-delete"></i>
              <span>Delete</span>
            </button>

            <button
              class="w-full px-4 py-3 bg-gray-200 dark:bg-brand-800 text-gray-700 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-brand-700 transition-colors mt-2"
              @click="close"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Set Position Modal -->
  <Teleport to="body">
    <div
      v-if="showPositionModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4"
      @click.self="showPositionModal = false"
    >
      <div
        class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-sm w-full p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Set Position
        </h3>
        <input
          v-model="positionInput"
          type="number"
          min="0"
          placeholder="Position number"
          class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800 mb-4"
          @keyup.enter="savePosition"
        />
        <div class="flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700"
            @click="showPositionModal = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
            @click="savePosition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Delete Confirmation Modal -->
  <Teleport to="body">
    <div
      v-if="showDeleteModal && deleteLinkData"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4"
      @click.self="showDeleteModal = false"
    >
      <div
        class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-sm w-full p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Delete Link
        </h3>
        <p class="text-gray-600 dark:text-brand-300 mb-4">
          Are you sure you want to delete
          <strong class="text-gray-900 dark:text-white">{{
            deleteLinkData.title
          }}</strong
          >? This cannot be undone.
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
