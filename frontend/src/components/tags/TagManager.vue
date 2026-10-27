<script setup>
import { nextTick, ref } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";
import { useDialogStore } from "@/stores/dialog";
import { linkCount } from "@/lib/linkCount";
import { filterHref, isPlainClick } from "@/lib/filterLinks";

// Same look as the categories manager: an "Add" button that opens a form,
// then one row per tag with its link count, Edit and Delete. The name
// shows the links with that tag.
defineProps({
  open: Boolean,
  tags: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "create", "rename", "remove", "filter"]);

const name = ref("");
const showCreateForm = ref(false);
const createInput = ref(null);

const editingId = ref(null);
const editName = ref("");

async function openCreateForm() {
  showCreateForm.value = true;
  await nextTick();
  createInput.value?.focus();
}

function createTag() {
  if (!name.value.trim()) return;
  emit("create", name.value);
  name.value = "";
  showCreateForm.value = false;
}

function startEdit(tag) {
  editingId.value = tag.id;
  editName.value = tag.name;
}

function saveEdit(tag) {
  const next = editName.value.trim();
  if (next && next !== tag.name) emit("rename", tag.id, next);
  editingId.value = null;
}

async function promptDelete(tag) {
  const count = tag.usage_count || 0;
  const ok = await useDialogStore().confirmDelete({
    title: `Delete tag "${tag.name}"?`,
    message: count
      ? `It comes off ${linkCount(count)}. The links themselves stay. This can't be undone.`
      : "No links use it. This can't be undone.",
  });
  if (ok) emit("remove", tag.id);
}
</script>

<template>
  <BaseModal :open="open" title="Manage tags" @close="emit('close')">
    <div class="space-y-4" data-testid="tag-manager">
      <p class="text-sm text-gray-600 dark:text-brand-300">
        Tags label links across categories. Pick a tag to see its links.
      </p>

      <button
        v-if="!showCreateForm"
        title="Create a new tag"
        class="w-full px-3 py-2 rounded-md border-2 border-dashed border-gray-300 dark:border-brand-700 text-gray-600 dark:text-brand-400 hover:border-brand-500 hover:text-brand-600 dark:hover:border-brand-500 dark:hover:text-brand-300 transition-colors flex items-center justify-center gap-2"
        data-testid="add-tag"
        @click="openCreateForm"
      >
        <i class="mdi mdi-plus"></i>
        Add tag
      </button>

      <form
        v-else
        class="flex flex-wrap gap-2"
        data-testid="create-tag-form"
        @submit.prevent="createTag"
      >
        <input
          ref="createInput"
          v-model="name"
          placeholder="Tag name"
          aria-label="Tag name"
          class="flex-1 min-w-0 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        />
        <button
          title="Create this tag"
          class="px-3 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        >
          Create tag
        </button>
        <button
          title="Cancel without creating"
          type="button"
          class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 text-gray-600 dark:text-brand-400 hover:bg-gray-100 dark:hover:bg-brand-800"
          @click="showCreateForm = false"
        >
          Cancel
        </button>
      </form>

      <p
        v-if="!tags.length"
        class="text-sm text-center text-gray-500 dark:text-brand-400 py-4"
      >
        No tags yet. Add one here, or while editing a link.
      </p>
      <ul v-else class="space-y-2 max-h-[50dvh] overflow-auto">
        <li
          v-for="tag in tags"
          :key="tag.id"
          class="border border-gray-200 dark:border-brand-800 rounded-md p-3"
          data-testid="tag-row"
        >
          <div
            v-if="editingId !== tag.id"
            class="flex items-center justify-between gap-2"
          >
            <a
              class="flex items-center gap-2 min-w-0 text-left group"
              :href="filterHref('edit', { tag: tag.id })"
              :title="`Show links tagged ${tag.name}`"
              data-testid="tag-filter"
              @click="isPlainClick($event) && ($event.preventDefault(), emit('filter', tag.id))"
            >
              <i class="mdi mdi-tag-outline text-lg text-brand-600 dark:text-brand-400"></i>
              <span class="min-w-0">
                <span class="block font-medium truncate group-hover:underline">#{{ tag.name }}</span>
                <span class="block text-xs text-gray-500 dark:text-brand-400">
                  {{ linkCount(tag.usage_count) }}
                </span>
              </span>
            </a>
            <div class="flex items-center gap-3 text-sm shrink-0">
              <button
                :title="`Rename ${tag.name}`"
                class="text-brand-600 dark:text-brand-400"
                @click="startEdit(tag)"
              >
                Edit
              </button>
              <button
                :title="`Delete ${tag.name}`"
                class="text-red-600 dark:text-red-400"
                @click="promptDelete(tag)"
              >
                Delete
              </button>
            </div>
          </div>

          <form v-else class="flex flex-wrap gap-2" @submit.prevent="saveEdit(tag)">
            <input
              v-model="editName"
              aria-label="Tag name"
              class="flex-1 min-w-0 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
            />
            <button
              title="Save changes"
              class="px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 text-sm"
            >
              Save
            </button>
            <button
              title="Discard changes"
              type="button"
              class="px-3 py-1.5 rounded-md border border-gray-300 dark:border-brand-700 text-sm"
              @click="editingId = null"
            >
              Cancel
            </button>
          </form>
        </li>
      </ul>
    </div>
  </BaseModal>
</template>
