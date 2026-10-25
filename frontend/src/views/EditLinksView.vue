<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
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

// Search + filter
const localSearch = ref(appStore.search);
const localFilterCategory = ref(appStore.filterCategory);
let searchTimeout = null;

watch(localSearch, (val) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    appStore.search = val;
  }, 300);
});

onUnmounted(() => {
  clearTimeout(searchTimeout);
});

watch(localFilterCategory, (val) => {
  appStore.filterCategory = val;
});

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

// Reload links when search/filter changes
watch(
  () => [appStore.search, appStore.filterCategory],
  async () => {
    await appStore.loadLinks({ reset: true });
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
  <section class="space-y-3 sm:space-y-4">
    <div class="flex flex-wrap gap-2">
      <button
        class="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="openCreate"
      >
        + Add link
      </button>
      <button
        class="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="showCategoryModal = true"
      >
        Categories
      </button>
      <button
        class="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="showTagModal = true"
      >
        Tags
      </button>
    </div>

    <!-- Search and category filter -->
    <div
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-2 sm:p-3 flex gap-2"
    >
      <input
        v-model="localSearch"
        type="search"
        placeholder="Search links..."
        class="flex-1 min-w-0 sm:min-w-[200px] px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      />
      <select
        v-model="localFilterCategory"
        class="max-w-[40%] sm:max-w-none px-2 sm:px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      >
        <option value="">All Categories</option>
        <option
          v-for="cat in appStore.categories"
          :key="cat.id"
          :value="cat.id"
        >
          {{ cat.name }}
        </option>
      </select>
    </div>

    <!-- Pagination info -->
    <p
      v-if="appStore.total > 0"
      class="text-xs sm:text-sm text-gray-500 dark:text-brand-400"
    >
      Showing {{ appStore.links.length }} of {{ appStore.total }} links
    </p>

    <div
      v-if="appStore.links.length"
      class="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-3"
    >
      <LinkCardEdit
        v-for="link in appStore.links"
        :key="link.id"
        :link="link"
        @edit="openEdit"
        @delete="handleDelete"
        @copy-public="copyPublic"
      />
    </div>

    <div v-else class="py-10 text-center text-gray-500 dark:text-brand-400">
      <i class="mdi mdi-link-off text-6xl block mb-2"></i>
      No links yet. Add your first link!
    </div>

    <div v-if="appStore.hasMore" class="text-center">
      <button
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="appStore.loadMore()"
      >
        Load more
      </button>
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
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-70 p-4"
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
