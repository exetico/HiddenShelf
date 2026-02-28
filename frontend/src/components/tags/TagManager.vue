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

function createTag() {
  if (!name.value.trim()) return;
  emit("create", name.value);
  name.value = "";
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
            @click="emit('remove', tag.id)"
          >
            Delete
          </button>
        </li>
      </ul>
    </div>
  </BaseModal>
</template>
