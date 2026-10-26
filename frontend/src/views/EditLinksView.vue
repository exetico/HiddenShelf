<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { appUrl } from "@/lib/appUrl";
import LinkCardEdit from "@/components/links/LinkCardEdit.vue";
import LinkFormModal from "@/components/links/LinkFormModal.vue";
import CategoryManager from "@/components/categories/CategoryManager.vue";
import TagManager from "@/components/tags/TagManager.vue";
import TrashModal from "@/components/links/TrashModal.vue";
import ActiveTagFilter from "@/components/tags/ActiveTagFilter.vue";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const toastStore = useToastStore();

const showLinkModal = ref(false);
const showCategoryModal = ref(false);
const showTagModal = ref(false);
const showTrash = ref(false);
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

// The top bar's search (desktop) sets the store directly
watch(
  () => appStore.search,
  (val) => {
    if (val !== localSearch.value) localSearch.value = val;
  },
);

watch(localFilterCategory, (val) => {
  appStore.filterCategory = val;
});


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
  if (route.query.new) openCreateFromRoute();
});

// "Add link" in the top bar comes here with ?new=1
function openCreateFromRoute() {
  openCreate();
  router.replace({ name: "edit" });
}
watch(
  () => route.query.new,
  (isNew) => isNew && openCreateFromRoute(),
);

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

// Goes to the trash; the toast has Undo
async function handleDelete(id) {
  try {
    await appStore.deleteLink(id);
  } catch (error) {
    toastStore.error(error.message || "Couldn't delete the link");
  }
}

async function copyPublic(hash) {
  await navigator.clipboard.writeText(appUrl(`/h/${hash}`));
  toastStore.success("Public URL copied");
}
</script>

<template>
  <section class="space-y-3 sm:space-y-4">
    <div class="flex flex-wrap gap-2">
      <!-- From md up, "Add link" is in the top bar -->
      <button
        title="Add a new link"
        class="md:hidden px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="openCreate"
      >
        + Add link
      </button>
      <button
        title="Create, edit, order and share categories"
        class="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="showCategoryModal = true"
      >
        Categories
      </button>
      <button
        title="Create and delete tags"
        class="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="showTagModal = true"
      >
        Tags
      </button>
      <button
        title="Deleted links: restore them or delete them for good"
        class="ml-auto px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md border border-gray-300 dark:border-brand-700 text-gray-700 dark:text-brand-200 hover:bg-gray-100 dark:hover:bg-brand-800"
        data-testid="open-trash"
        @click="showTrash = true"
      >
        <i class="mdi mdi-delete-outline" aria-hidden="true"></i>
        <span class="max-sm:sr-only"> Trash</span>
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
        class="md:hidden flex-1 min-w-0 sm:min-w-[200px] px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        data-testid="page-search"
      />
      <select
        v-model="localFilterCategory"
        class="max-w-[40%] sm:max-w-none md:max-w-xs px-2 sm:px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
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

    <ActiveTagFilter />

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
        title="Load more links"
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

    <TrashModal :open="showTrash" @close="showTrash = false" />

    <TagManager
      :open="showTagModal"
      :tags="appStore.tags"
      @close="showTagModal = false"
      @create="appStore.createTag"
      @remove="appStore.deleteTag"
    />
  </section>
</template>
