<script setup>
import { useAppStore } from "@/stores/app";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { useToastStore } from "@/stores/toast";
import LinkFormModal from "@/components/links/LinkFormModal.vue";

const appStore = useAppStore();
const editor = useLinkEditorStore();

// updateLink shows its own "Link updated" toast; on failure the form stays
async function save(payload) {
  try {
    await appStore.updateLink(editor.link.id, payload);
    editor.close();
  } catch (error) {
    useToastStore().error(error.message || "Couldn't update the link");
  }
}
</script>

<template>
  <LinkFormModal
    :open="Boolean(editor.link)"
    :model="editor.link"
    :categories="appStore.categories"
    @close="editor.close()"
    @save="save"
  />
</template>
