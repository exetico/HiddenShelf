<script setup>
import { ref } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";

const props = defineProps({
  open: Boolean,
  tags: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "create", "remove"]);
const name = ref("");

// Delete confirmation
const showDeleteModal = ref(false);
const deleteTarget = ref(null);

function createTag() {
  if (!name.value.trim()) return;
  emit("create", name.value);
  name.value = "";
}

function promptDelete(tag) {
  deleteTarget.value = tag;
  showDeleteModal.value = true;
}

function confirmDelete() {
  emit("remove", deleteTarget.value.id);
  showDeleteModal.value = false;
}
</script>

<template>
  <BaseModal :open="open" title="Tags" @close="emit('close')">
    <div class="space-y-4">
      <form class="flex gap-2" @submit.prevent="createTag">
        <input
          v-model="name"
          placeholder="Tag name"
          class="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        />
        <button
          class="px-3 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        >
          Add
        </button>
      </form>

      <ul class="space-y-2 max-h-64 overflow-auto">
        <li
          v-for="tag in tags"
          :key="tag.id"
          class="flex items-center justify-between border border-gray-200 dark:border-brand-800 rounded-md p-2"
        >
          <span>{{ tag.name }}</span>
          <button
            class="text-red-600 dark:text-red-400 text-sm"
            @click="promptDelete(tag)"
          >
            Delete
          </button>
        </li>
      </ul>
    </div>
  </BaseModal>

  <!-- Delete Confirmation Modal -->
  <Teleport to="body">
    <div
      v-if="showDeleteModal && deleteTarget"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4"
      @click.self="showDeleteModal = false"
    >
      <div
        class="bg-white dark:bg-brand-900 rounded-lg shadow-xl max-w-sm w-full p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Delete Tag
        </h3>
        <p class="text-gray-600 dark:text-brand-300 mb-4">
          Are you sure you want to delete
          <strong class="text-gray-900 dark:text-white">{{
            deleteTarget.name
          }}</strong
          >? It will be removed from all links.
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
