<script setup>
import { useAppStore } from "@/stores/app";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { useToastStore } from "@/stores/toast";
import LinkFormModal from "@/components/links/LinkFormModal.vue";

const appStore = useAppStore();
const editor = useLinkEditorStore();

// The store actions show their own toasts; on failure the form stays open
async function save(payload) {
  const id = editor.link?.id;
  try {
    if (id) await appStore.updateLink(id, payload);
    else await appStore.createLink(payload);
    editor.close();
  } catch (error) {
    useToastStore().error(error.message || "Couldn't save the link");
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
