<script setup>
import { useFilterQuery } from "@/composables/useFilterQuery";
import { quickAddFromQuery } from "@/lib/quickAdd";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { shownCount } from "@/lib/linkCount";
import { useToastStore } from "@/stores/toast";
import { useLinkEditorStore } from "@/stores/linkEditor";
import LinkCardEdit from "@/components/links/LinkCardEdit.vue";
import LinkRowEdit from "@/components/links/LinkRowEdit.vue";
import CategoryManager from "@/components/categories/CategoryManager.vue";
import TagManager from "@/components/tags/TagManager.vue";
import TrashModal from "@/components/links/TrashModal.vue";
import SearchField from "@/components/common/SearchField.vue";
import ActiveTagFilter from "@/components/tags/ActiveTagFilter.vue";
import SortSelect from "@/components/common/SortSelect.vue";
import HiddenMatchesNote from "@/components/categories/HiddenMatchesNote.vue";
import CategoryFilterBar from "@/components/categories/CategoryFilterBar.vue";
import CategoryPicker from "@/components/categories/CategoryPicker.vue";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
// Filters from the address bar (?category=, ?tag=, ?q=, ?sort=). The
// whole shelf is already loaded, so they apply at once.
useFilterQuery();
const filtering = computed(
  () => Boolean(appStore.search.trim() || appStore.filterCategory || appStore.filterTag),
);
const toastStore = useToastStore();

// The bar's secondary buttons: no fill, a visible border
const OUTLINE =
  "flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-md border border-gray-300 dark:border-brand-700 text-gray-800 dark:text-brand-100 hover:bg-white dark:hover:bg-brand-800";

// Cards or a compact list. Remembered in this browser only; a missing
// or unknown value means cards.
const LAYOUT_KEY = "hiddenshelf_edit_layout";
function readLayout() {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}
const layout = ref(readLayout());
function setLayout(value) {
  layout.value = value;
  try {
    localStorage.setItem(LAYOUT_KEY, value);
  } catch {
    // private mode: the choice lasts until the page closes
  }
}
const LAYOUTS = [
  { value: "cards", icon: "mdi-view-grid-outline", label: "Cards", title: "Show the links as cards" },
  { value: "list", icon: "mdi-view-list-outline", label: "List", title: "Show the links as a compact list" },
];

const showCategoryModal = ref(false);
const showTagModal = ref(false);
const showTrash = ref(false);
const editor = useLinkEditorStore();



function openEditById(editId) {
  const id = Number(editId);
  const link = appStore.allLinks.find((l) => l.id === id);
  if (link) {
    editor.open(link);
    router.replace({ name: "edit" });
  }
}

onMounted(() => {
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

// Opened straight from an address: the shelf may still be loading
watch(
  () => appStore.linksLoaded,
  (loaded) => {
    if (loaded && route.query.editId) openEditById(route.query.editId);
  },
);
watch(
  () => route.query.editId,
  (editId) => {
    if (editId) {
      openEditById(editId);
    }
  },
);

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
  appStore.filterCategory = String(id);
}
function filterByTag(id) {
  showTagModal.value = false;
  appStore.filterByTag(id);
}

// Asks, then moves it to the trash; the toast has Undo
async function handleDelete(id) {
  const link = appStore.allLinks.find((l) => l.id === id) || { id, title: "this link" };
  try {
    await appStore.trashLink(link);
  } catch (error) {
    toastStore.error(error.message || "Couldn't delete the link");
  }
}

</script>

<template>
  <section class="space-y-3 sm:space-y-4" data-testid="edit-page">
    <!-- The same category chips as View (from sm up), so picking a
         category looks and works the same on both pages: icons, counts,
         Uncategorized, shared and favorites. On phones, the same picker
         as View sits beside search. -->
    <CategoryFilterBar class="hidden sm:block" />

    <!-- Finding and managing links. Phones: the category picker and search
         on the first row, the buttons on the second. From md up (where
         search and "Add link" are in the top bar): the managers, and Trash
         at the end. -->
    <!-- On the page background, not a white card, so the outlined
         controls keep their contrast -->
    <div
      class="flex flex-wrap items-center gap-2"
      data-testid="edit-toolbar"
    >
      <!-- The picker hides itself from sm up, where the chips show -->
      <div class="md:hidden flex flex-1 basis-full min-w-0 gap-2">
        <CategoryPicker />
        <!-- The floating search bar (Settings) replaces this one -->
        <SearchField
          v-if="appStore.settings.floating_search !== true"
          v-model="appStore.search"
          placeholder="Search links..."
          class="h-9"
          data-testid="page-search"
        />
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

    <!-- Count and sort -->
    <div
      v-if="appStore.allLinks.length > 0"
      class="flex items-center justify-between gap-2"
    >
      <p
        class="text-xs sm:text-sm text-gray-500 dark:text-brand-400"
        data-testid="link-count"
      >
        {{ shownCount(appStore.links.length, appStore.total, filtering) }}
      </p>
      <div class="flex items-center gap-2">
        <div
          class="inline-flex rounded-md border border-gray-300 dark:border-brand-700 bg-white dark:bg-brand-900 p-px"
          role="group"
          aria-label="Layout"
          data-testid="layout-toggle"
        >
          <button
            v-for="option in LAYOUTS"
            :key="option.value"
            type="button"
            class="inline-flex items-center justify-center w-7 h-[1.625rem] sm:h-7 rounded text-base leading-none"
            :class="
              layout === option.value
                ? 'bg-brand-600 text-white'
                : 'text-gray-500 hover:bg-gray-100 dark:text-brand-300 dark:hover:bg-brand-800'
            "
            :title="option.title"
            :aria-label="option.label"
            :aria-pressed="layout === option.value"
            :data-testid="`layout-${option.value}`"
            @click="setLayout(option.value)"
          >
            <i class="mdi" :class="option.icon" aria-hidden="true"></i>
          </button>
        </div>
        <SortSelect />
      </div>
    </div>

    <!-- Compact list: one tight row per link, same actions as the cards -->
    <ul
      v-if="appStore.links.length && layout === 'list'"
      class="bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 rounded-lg divide-y divide-gray-100 dark:divide-brand-800 overflow-hidden"
      data-testid="link-list"
    >
      <LinkRowEdit
        v-for="link in appStore.links"
        :key="link.id"
        class="shelf-row"
        :link="link"
        @edit="openEdit"
        @delete="handleDelete"
      />
    </ul>

    <div
      v-else-if="appStore.links.length"
      class="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-3"
      data-testid="link-grid"
    >
      <!-- shelf-card: off-screen cards are skipped until you scroll near -->
      <LinkCardEdit
        v-for="link in appStore.links"
        :key="link.id"
        class="shelf-card"
        :link="link"
        @edit="openEdit"
        @delete="handleDelete"
      />
    </div>

    <div
      v-else-if="appStore.linksLoaded"
      class="py-10 text-center text-gray-500 dark:text-brand-400"
      data-testid="no-links"
    >
      <i class="mdi mdi-link-off text-6xl block mb-2"></i>
      {{ appStore.allLinks.length ? "No links found." : "No links yet. Add your first link!" }}
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
