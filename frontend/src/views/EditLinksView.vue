<script setup>
import { useInfiniteScroll } from "@/composables/useInfiniteScroll";
import { useLinkFilterReload } from "@/composables/useLinkFilterReload";
import { useFilterQuery } from "@/composables/useFilterQuery";
import { quickAddFromQuery } from "@/lib/quickAdd";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { useLinkEditorStore } from "@/stores/linkEditor";
import LinkCardEdit from "@/components/links/LinkCardEdit.vue";
import CategoryManager from "@/components/categories/CategoryManager.vue";
import TagManager from "@/components/tags/TagManager.vue";
import TrashModal from "@/components/links/TrashModal.vue";
import SearchField from "@/components/common/SearchField.vue";
import ActiveTagFilter from "@/components/tags/ActiveTagFilter.vue";
import HiddenMatchesNote from "@/components/categories/HiddenMatchesNote.vue";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
// First, so the first load already uses filters from the address
useFilterQuery();
// Load the next page as you near the bottom; the button stays as a fallback
const { sentinel } = useInfiniteScroll({
  hasMore: () => appStore.hasMore,
  loadMore: () => appStore.loadMore(),
  count: () => appStore.links.length,
});
const toastStore = useToastStore();

// The bar's secondary buttons: no fill, a visible border
const OUTLINE =
  "flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md border border-gray-300 dark:border-brand-700 text-gray-800 dark:text-brand-100 hover:bg-white dark:hover:bg-brand-800";

const showCategoryModal = ref(false);
const showTagModal = ref(false);
const showTrash = ref(false);
const editor = useLinkEditorStore();

// The category select; ids are strings, as in the address bar
const localFilterCategory = computed({
  get: () => String(appStore.filterCategory || ""),
  set: (value) => {
    appStore.filterCategory = value;
  },
});


function openEditById(editId) {
  const id = Number(editId);
  const link = appStore.links.find((l) => l.id === id);
  if (link) {
    editor.open(link);
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

// The bookmarklet opens /edit?new=1&url=…&title=… for the page it was
// clicked on
function openCreateFromRoute() {
  editor.create(quickAddFromQuery(route.query));
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

function openCreate() {
  editor.create();
}

function openEdit(link) {
  editor.open(link);
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
  localFilterCategory.value = String(id);
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
    <!-- One bar for finding and managing links. Phones: search and the
         category on the first row, the buttons on the second. From md up
         (where search and "Add link" are in the top bar): the category,
         the managers, and Trash at the end. -->
    <!-- On the page background, not a white card, so the outlined
         controls keep their contrast -->
    <div
      class="flex flex-wrap items-center gap-2"
      data-testid="edit-toolbar"
    >
      <div class="md:hidden flex flex-1 min-w-0">
        <SearchField
          v-model="appStore.search"
          placeholder="Search links..."
          data-testid="page-search"
        />
      </div>
      <!-- Our own chevron: the browser's sits too close to the edge and
           not quite centered -->
      <div class="relative max-w-[40%] md:max-w-xs">
      <select
        v-model="localFilterCategory"
        title="Show the links in one category"
        aria-label="Category"
        data-testid="category-filter"
        class="w-full appearance-none pl-3 pr-9 py-1.5 sm:py-2 text-sm sm:text-base rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-900 text-gray-800 dark:text-brand-100 hover:bg-gray-100 dark:hover:bg-brand-800 truncate"
      >
        <option value="">All Categories</option>
        <option
          v-for="cat in appStore.categories"
          :key="cat.id"
          :value="String(cat.id)"
        >
          {{ cat.name }}{{ cat.is_hidden ? " (hidden)" : "" }}
        </option>
      </select>
      <i
        class="mdi mdi-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-lg leading-none text-gray-500 dark:text-brand-300"
        aria-hidden="true"
      ></i>
      </div>

      <div class="flex flex-1 basis-full md:basis-auto items-center gap-2" data-testid="edit-actions">
        <!-- From md up, "Add link" is in the top bar -->
        <button
          title="Add a new link"
          class="md:hidden whitespace-nowrap px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md border border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
          data-testid="add-link"
          @click="openCreate"
        >
          + Add link
        </button>
        <!-- Outlined, like the rest of the bar's secondary actions -->
        <button
          title="Manage categories: add, rename, order, share and delete"
          :class="OUTLINE"
          data-testid="open-categories"
          @click="openCategories"
        >
          <i class="mdi mdi-folder-cog-outline" aria-hidden="true"></i>
          <span class="sm:hidden">Categories</span><span class="max-sm:hidden">Manage categories</span>
        </button>
        <button
          title="Manage tags: add, rename and delete"
          :class="OUTLINE"
          data-testid="open-tags"
          @click="openTags"
        >
          <i class="mdi mdi-tag-multiple-outline" aria-hidden="true"></i>
          <span class="sm:hidden">Tags</span><span class="max-sm:hidden">Manage tags</span>
        </button>
        <button
          title="Deleted links: restore them or delete them for good"
          :class="[OUTLINE, 'ml-auto']"
          data-testid="open-trash"
          @click="showTrash = true"
        >
          <i class="mdi mdi-delete-outline" aria-hidden="true"></i>
          <span class="max-sm:sr-only">Trash</span>
        </button>
      </div>
    </div>

    <ActiveTagFilter />
    <HiddenMatchesNote />

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
