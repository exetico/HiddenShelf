<script setup>
import { ref } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";

const props = defineProps({
  open: Boolean,
  categories: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "create", "remove"]);
const name = ref("");
const icon = ref("mdi-folder");
const color = ref("#687061");
const directRedirectDefault = ref(false);

function createCategory() {
  if (!name.value.trim()) return;
  emit("create", {
    name: name.value,
    icon: icon.value,
    color: color.value,
    direct_redirect_default: directRedirectDefault.value ? 1 : 0,
  });
  name.value = "";
}
</script>

<template>
  <BaseModal :open="open" title="Categories" @close="emit('close')">
    <div class="space-y-4">
      <form
        class="grid grid-cols-1 md:grid-cols-2 gap-2"
        @submit.prevent="createCategory"
      >
        <input
          v-model="name"
          placeholder="Category name"
          class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        />
        <input
          v-model="icon"
          placeholder="Icon"
          class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        />
        <input
          v-model="color"
          type="color"
          class="h-10 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        />
        <label class="flex items-center gap-2 text-sm">
          <input v-model="directRedirectDefault" type="checkbox" />
          Direct redirect default
        </label>
        <button
          class="md:col-span-2 px-3 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        >
          Create category
        </button>
      </form>

      <ul class="space-y-2 max-h-64 overflow-auto">
        <li
          v-for="category in categories"
          :key="category.id"
          class="flex items-center justify-between border border-gray-200 dark:border-brand-800 rounded-md p-2"
        >
          <div class="min-w-0">
            <p class="font-medium truncate">{{ category.name }}</p>
            <p class="text-xs text-gray-500 dark:text-brand-400">
              {{ category.link_count || 0 }} links
            </p>
          </div>
          <button
            class="text-red-600 dark:text-red-400 text-sm"
            @click="emit('remove', category.id)"
          >
            Delete
          </button>
        </li>
      </ul>
    </div>
  </BaseModal>
</template>
