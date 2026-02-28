<script setup>
import { reactive, watch } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";

const props = defineProps({
  open: Boolean,
  model: {
    type: Object,
    default: null,
  },
  categories: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "save"]);

const form = reactive({
  title: "",
  url: "",
  description: "",
  icon: "",
  category_id: "",
  tagsInput: "",
  is_public: false,
  direct_redirect: false,
});

watch(
  () => props.model,
  (model) => {
    form.title = model?.title || "";
    form.url = model?.url || "";
    form.description = model?.description || "";
    form.icon = model?.icon || "";
    form.category_id = model?.category_id || "";
    form.tagsInput = (model?.tags || []).map((tag) => tag.name).join(", ");
    form.is_public = Boolean(model?.is_public);
    form.direct_redirect = Boolean(model?.direct_redirect);
  },
  { immediate: true },
);

function submit() {
  emit("save", {
    title: form.title,
    url: form.url,
    description: form.description,
    icon: form.icon,
    category_id: form.category_id || null,
    tags: form.tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    is_public: form.is_public ? 1 : 0,
    direct_redirect: form.direct_redirect ? 1 : 0,
  });
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="model?.id ? 'Edit Link' : 'Add Link'"
    @close="emit('close')"
  >
    <form class="space-y-3" @submit.prevent="submit">
      <input
        v-model="form.title"
        required
        placeholder="Title"
        class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      />
      <input
        v-model="form.url"
        required
        type="url"
        placeholder="https://..."
        class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      />
      <textarea
        v-model="form.description"
        placeholder="Description"
        class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      />
      <div class="flex items-center gap-2">
        <input
          v-model="form.icon"
          placeholder="Icon (mdi-link-variant)"
          class="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        />
        <i
          :class="form.icon || 'mdi-link-variant'"
          class="mdi text-2xl text-brand-600"
        ></i>
        <a
          href="https://pictogrammers.com/library/mdi/"
          target="_blank"
          class="text-xs text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap"
        >
          Browse icons →
        </a>
      </div>
      <select
        v-model="form.category_id"
        class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      >
        <option value="">Uncategorized</option>
        <option
          v-for="category in categories"
          :key="category.id"
          :value="category.id"
        >
          {{ category.name }}
        </option>
      </select>
      <input
        v-model="form.tagsInput"
        placeholder="tags, separated, by, comma"
        class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      />

      <label class="flex items-center gap-2 text-sm">
        <input v-model="form.is_public" type="checkbox" />
        Public link
      </label>
      <label v-if="form.is_public" class="flex items-center gap-2 text-sm">
        <input v-model="form.direct_redirect" type="checkbox" />
        Direct redirect
      </label>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-3 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        >
          Save
        </button>
      </div>
    </form>
  </BaseModal>
</template>
