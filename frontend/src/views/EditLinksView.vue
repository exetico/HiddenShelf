<script setup>
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import LinkCardEdit from "@/components/links/LinkCardEdit.vue";
import LinkFormModal from "@/components/links/LinkFormModal.vue";
import CategoryManager from "@/components/categories/CategoryManager.vue";
import TagManager from "@/components/tags/TagManager.vue";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const toastStore = useToastStore();

const showLinkModal = ref(false);
const showCategoryModal = ref(false);
const showTagModal = ref(false);
const activeLink = ref(null);

// Delete confirmation modal
const showDeleteModal = ref(false);
const deleteTarget = ref(null);

function openEditById(editId) {
  const id = Number(editId);
  const link = appStore.links.find((l) => l.id === id);
  if (link) {
    activeLink.value = link;
    showLinkModal.value = true;
    router.replace({ name: "edit" });
  }
}

onMounted(async () => {
  if (!appStore.links.length) {
    await appStore.loadLinks({ reset: true });
  }
  if (route.query.editId) {
    openEditById(route.query.editId);
  }
});

watch(
  () => route.query.editId,
  (editId) => {
    if (editId) {
      openEditById(editId);
    }
  },
);

function openCreate() {
  activeLink.value = null;
  showLinkModal.value = true;
}

function openEdit(link) {
  activeLink.value = link;
  showLinkModal.value = true;
}

async function handleSave(payload) {
  if (activeLink.value?.id) {
    await appStore.updateLink(activeLink.value.id, payload);
  } else {
    await appStore.createLink(payload);
  }
  showLinkModal.value = false;
}

function handleDelete(id) {
  const link = appStore.links.find((l) => l.id === id);
  deleteTarget.value = { id, title: link?.title || "this link" };
  showDeleteModal.value = true;
}

async function confirmDelete() {
  await appStore.deleteLink(deleteTarget.value.id);
  showDeleteModal.value = false;
}

async function copyPublic(hash) {
  await navigator.clipboard.writeText(`${window.location.origin}/h/${hash}`);
  toastStore.success("Public URL copied");
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <button
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="openCreate"
      >
        + Add link
      </button>
      <button
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="showCategoryModal = true"
      >
        Categories
      </button>
      <button
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="showTagModal = true"
      >
        Tags
      </button>
    </div>

    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <LinkCardEdit
        v-for="link in appStore.links"
        :key="link.id"
        :link="link"
        @edit="openEdit"
        @delete="handleDelete"
        @copy-public="copyPublic"
      />
    </div>

    <LinkFormModal
      :open="showLinkModal"
      :model="activeLink"
      :categories="appStore.categories"
      @close="showLinkModal = false"
      @save="handleSave"
    />

    <CategoryManager
      :open="showCategoryModal"
      :categories="appStore.categories"
      @close="showCategoryModal = false"
      @create="appStore.createCategory"
      @update="(id, payload) => appStore.updateCategory(id, payload)"
      @remove="appStore.deleteCategory"
    />

    <TagManager
      :open="showTagModal"
      :tags="appStore.tags"
      @close="showTagModal = false"
      @create="appStore.createTag"
      @remove="appStore.deleteTag"
    />

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
            Delete Link
          </h3>
          <p class="text-gray-600 dark:text-brand-300 mb-4">
            Are you sure you want to delete
            <strong class="text-gray-900 dark:text-white">{{
              deleteTarget.title
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
  </section>
</template>
