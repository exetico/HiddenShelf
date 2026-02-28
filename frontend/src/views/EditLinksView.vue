<script setup>
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import LinkCardEdit from "@/components/links/LinkCardEdit.vue";
import LinkFormModal from "@/components/links/LinkFormModal.vue";
import CategoryManager from "@/components/categories/CategoryManager.vue";
import TagManager from "@/components/tags/TagManager.vue";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const showLinkModal = ref(false);
const showCategoryModal = ref(false);
const showTagModal = ref(false);
const activeLink = ref(null);

function openEditById(editId) {
  const id = Number(editId);
  const link = appStore.links.find((l) => l.id === id);
  if (link) {
    activeLink.value = link;
    showLinkModal.value = true;
    // Clean the query param so it doesn't re-trigger
    router.replace({ name: "edit" });
  }
}

onMounted(async () => {
  if (!appStore.links.length) {
    await appStore.loadLinks({ reset: true });
  }
  // Check for editId query param (from context menu "Edit" on view page)
  if (route.query.editId) {
    openEditById(route.query.editId);
  }
});

// Also watch for query changes (navigating while already on edit page)
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

async function handleDelete(id) {
  if (!window.confirm("Delete this link?")) return;
  await appStore.deleteLink(id);
}

async function copyPublic(hash) {
  await navigator.clipboard.writeText(`${window.location.origin}/h/${hash}`);
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
  </section>
</template>
