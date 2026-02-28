<script setup>
import { ref, reactive } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";

const props = defineProps({
  open: Boolean,
  categories: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "create", "update", "remove"]);

const name = ref("");
const icon = ref("mdi-folder");
const color = ref("#687061");
const directRedirectDefault = ref(false);

// Edit state
const editingId = ref(null);
const editForm = reactive({
  name: "",
  icon: "",
  color: "#687061",
  direct_redirect_default: false,
});

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
</script>

<template>
  <BaseModal :open="open" title="Categories" @close="emit('close')">
    <div class="space-y-4">
      <!-- Create form -->
      <form class="space-y-2" @submit.prevent="createCategory">
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
                class="text-brand-600 dark:text-brand-400"
                @click="startEdit(category)"
              >
                Edit
              </button>
              <button
                class="text-red-600 dark:text-red-400"
                @click="emit('remove', category.id)"
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
  </BaseModal>
</template>
