<script setup>
import { useInfiniteScroll } from "@/composables/useInfiniteScroll";
import { useLinkFilterReload } from "@/composables/useLinkFilterReload";
import { quickAddFromQuery } from "@/lib/quickAdd";
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import LinkCardEdit from "@/components/links/LinkCardEdit.vue";
import LinkFormModal from "@/components/links/LinkFormModal.vue";
import CategoryManager from "@/components/categories/CategoryManager.vue";
import TagManager from "@/components/tags/TagManager.vue";
import TrashModal from "@/components/links/TrashModal.vue";
import SearchField from "@/components/common/SearchField.vue";
import ActiveTagFilter from "@/components/tags/ActiveTagFilter.vue";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
// Load the next page as you near the bottom; the button stays as a fallback
const { sentinel } = useInfiniteScroll({
  hasMore: () => appStore.hasMore,
  loadMore: () => appStore.loadMore(),
  count: () => appStore.links.length,
});
const toastStore = useToastStore();

const showLinkModal = ref(false);
const showCategoryModal = ref(false);
const showTagModal = ref(false);
const showTrash = ref(false);
const activeLink = ref(null);

// Search + filter
const localFilterCategory = ref(appStore.filterCategory);
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
  // Before start-up is done, its own load (in the right page size) is coming
  if (!appStore.links.length && appStore.settingsLoaded) {
    await appStore.loadLinks({ reset: true });
  }
  if (route.query.editId) {
    openEditById(route.query.editId);
  }
  if (route.query.new) openCreateFromRoute();
});

// "Add link" in the top bar comes here with ?new=1; the bookmarklet adds
// &url=…&title=… for the page it was clicked on
function openCreateFromRoute() {
  openCreate();
  activeLink.value = { ...activeLink.value, ...quickAddFromQuery(route.query) };
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

// Edit lists newest first, across categories
appStore.setLinkGrouping("");
useLinkFilterReload();

// A new link starts in the category and with the tag the list is
// filtered by, so it shows up in the list you're looking at
function openCreate() {
  const category = Number(appStore.filterCategory) || "";
  const tag = appStore.tags.find((t) => String(t.id) === appStore.filterTag);
  activeLink.value = {
    category_id: appStore.categories.some((c) => c.id === category) ? category : "",
    tags: tag ? [{ name: tag.name }] : [],
  };
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

// The managers show link counts, which editing links changes
function openCategories() {
  showCategoryModal.value = true;
  appStore.loadCategories().catch(() => {});
}
function openTags() {
  showTagModal.value = true;
  appStore.loadTags().catch(() => {});
}

async function runTagAction(action) {
  try {
    await action();
  } catch (error) {
    toastStore.error(error.message || "Couldn't change the tag");
  }
}

// Picking a category or tag in its manager shows its links here
function filterByCategory(id) {
  showCategoryModal.value = false;
  localFilterCategory.value = id;
}
function filterByTag(id) {
  showTagModal.value = false;
  appStore.filterByTag(id);
}

// Asks, then moves it to the trash; the toast has Undo
async function handleDelete(id) {
  const link = appStore.links.find((l) => l.id === id) || { id, title: "this link" };
  try {
    await appStore.trashLink(link);
  } catch (error) {
    toastStore.error(error.message || "Couldn't delete the link");
  }
}

</script>

<template>
  <section class="space-y-3 sm:space-y-4" data-testid="edit-page">
    <div class="flex flex-wrap gap-2" data-testid="edit-toolbar">
      <!-- From md up, "Add link" is in the top bar -->
      <button
        title="Add a new link"
        class="md:hidden px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md bg-brand-600 text-white hover:bg-brand-700"
        data-testid="add-link"
        @click="openCreate"
      >
        + Add link
      </button>
      <!-- Both managers open the same way and look the same -->
      <button
        title="Manage categories: add, rename, order, share and delete"
        class="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md border border-gray-300 dark:border-brand-700 text-gray-700 dark:text-brand-200 hover:bg-gray-100 dark:hover:bg-brand-800"
        data-testid="open-categories"
        @click="openCategories"
      >
        <i class="mdi mdi-folder-cog-outline" aria-hidden="true"></i>
        <span class="sm:hidden">Categories</span><span class="max-sm:hidden">Manage categories</span>
      </button>
      <button
        title="Manage tags: add, rename and delete"
        class="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md border border-gray-300 dark:border-brand-700 text-gray-700 dark:text-brand-200 hover:bg-gray-100 dark:hover:bg-brand-800"
        data-testid="open-tags"
        @click="openTags"
      >
        <i class="mdi mdi-tag-multiple-outline" aria-hidden="true"></i>
        <span class="sm:hidden">Tags</span><span class="max-sm:hidden">Manage tags</span>
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
      data-testid="edit-filters"
    >
      <div class="md:hidden flex flex-1 min-w-0">
        <SearchField
          v-model="appStore.search"
          placeholder="Search links..."
          data-testid="page-search"
        />
      </div>
      <select
        v-model="localFilterCategory"
        data-testid="category-filter"
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
      data-testid="link-count"
    >
      Showing {{ appStore.links.length }} of {{ appStore.total }} links
    </p>

    <div
      v-if="appStore.links.length"
      class="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-3"
      data-testid="link-grid"
    >
      <LinkCardEdit
        v-for="link in appStore.links"
        :key="link.id"
        :link="link"
        @edit="openEdit"
        @delete="handleDelete"
      />
    </div>

    <div
      v-else
      class="py-10 text-center text-gray-500 dark:text-brand-400"
      data-testid="no-links"
    >
      <i class="mdi mdi-link-off text-6xl block mb-2"></i>
      No links yet. Add your first link!
    </div>

    <div ref="sentinel" aria-hidden="true" data-testid="scroll-sentinel"></div>
    <div v-if="appStore.hasMore" class="text-center">
      <button
        title="Load more links"
        data-testid="load-more"
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
      @filter="filterByCategory"
    />

    <TrashModal :open="showTrash" @close="showTrash = false" />

    <TagManager
      :open="showTagModal"
      :tags="appStore.tags"
      @close="showTagModal = false"
      @create="appStore.createTag"
      @rename="(id, name) => runTagAction(() => appStore.renameTag(id, name))"
      @remove="(id) => runTagAction(() => appStore.deleteTag(id))"
      @filter="filterByTag"
    />
  </section>
</template>
