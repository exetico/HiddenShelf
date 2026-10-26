<script setup>
import { ref, watch } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";
import { useAppStore } from "@/stores/app";
import { useDialogStore } from "@/stores/dialog";
import { useToastStore } from "@/stores/toast";
import { linksApi } from "@/services/api/linksApi";
import { formatDate } from "@/lib/date";

// Deleted links wait here for a while, then the server clears them out
const props = defineProps({ open: Boolean });
const emit = defineEmits(["close"]);

const appStore = useAppStore();
const toast = useToastStore();

const items = ref([]);
const days = ref(30);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const response = await linksApi.trash();
    items.value = response.links || [];
    days.value = response.days || 30;
  } catch (error) {
    toast.error(error.message || "Couldn't load the trash");
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => open && load(),
  { immediate: true },
);

async function restore(item) {
  try {
    await linksApi.restore(item.id);
    items.value = items.value.filter((l) => l.id !== item.id);
    await appStore.refreshLinks();
    toast.success(`Restored ${item.title}`);
  } catch (error) {
    toast.error(error.message || "Couldn't restore the link");
  }
}

async function deleteForever(item) {
  const ok = await useDialogStore().confirmDelete({
    title: `Delete "${item.title}" for good?`,
    message: "It can't be brought back after this.",
    confirmText: "Delete for good",
  });
  if (!ok) return;
  try {
    await linksApi.deleteForever(item.id);
    items.value = items.value.filter((l) => l.id !== item.id);
  } catch (error) {
    toast.error(error.message || "Couldn't delete the link");
  }
}

async function emptyTrash() {
  const count = items.value.length;
  const ok = await useDialogStore().confirmDelete({
    title: "Empty the trash?",
    message: `${count} ${count === 1 ? "link is" : "links are"} deleted for good. This can't be undone.`,
    confirmText: "Empty trash",
  });
  if (!ok) return;
  try {
    await linksApi.emptyTrash();
    items.value = [];
    toast.success("Trash emptied");
  } catch (error) {
    toast.error(error.message || "Couldn't empty the trash");
  }
}
</script>

<template>
  <BaseModal :open="open" title="Trash" @close="emit('close')">
    <div class="space-y-3" data-testid="trash">
      <p class="text-sm text-gray-500 dark:text-brand-400">
        Deleted links stay here for {{ days }} days, then they're gone for good.
      </p>

      <div v-if="loading && !items.length" class="py-6 text-center">
        <i class="mdi mdi-loading mdi-spin text-2xl text-brand-600"></i>
      </div>

      <p
        v-else-if="!items.length"
        class="py-6 text-center text-gray-500 dark:text-brand-400"
      >
        <i class="mdi mdi-delete-empty-outline text-4xl block mb-1"></i>
        The trash is empty.
      </p>

      <ul v-else class="divide-y divide-gray-100 dark:divide-brand-800">
        <li
          v-for="item in items"
          :key="item.id"
          class="flex items-center gap-2 py-2"
          data-testid="trash-item"
        >
          <i
            :class="item.icon || 'mdi-link-variant'"
            class="mdi text-lg text-gray-400 shrink-0"
            aria-hidden="true"
          ></i>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ item.title }}</p>
            <p class="text-xs text-gray-500 dark:text-brand-400 truncate">
              Deleted {{ formatDate(item.deleted_at) }}
              <template v-if="item.category_name"> · {{ item.category_name }}</template>
            </p>
          </div>
          <button
            type="button"
            class="px-2 py-1 text-sm rounded-md text-brand-600 dark:text-brand-300 hover:bg-gray-100 dark:hover:bg-brand-800 shrink-0"
            :title="`Put ${item.title} back on the shelf`"
            @click="restore(item)"
          >
            <i class="mdi mdi-restore" aria-hidden="true"></i> Restore
          </button>
          <button
            type="button"
            class="p-1 text-red-600 dark:text-red-400 shrink-0"
            :title="`Delete ${item.title} for good`"
            :aria-label="`Delete ${item.title} for good`"
            @click="deleteForever(item)"
          >
            <i class="mdi mdi-delete-forever-outline text-lg" aria-hidden="true"></i>
          </button>
        </li>
      </ul>

      <div v-if="items.length" class="flex justify-end">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md border border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
          title="Delete everything in the trash for good"
          @click="emptyTrash"
        >
          Empty trash
        </button>
      </div>
    </div>
  </BaseModal>
</template>
