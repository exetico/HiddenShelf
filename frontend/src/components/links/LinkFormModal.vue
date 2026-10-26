<script setup>
import { reactive, watch, computed, ref } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";
import { linkVisitsApi } from "@/services/api/linkVisitsApi";

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
  tags: [],
  newTagInput: "",
  is_public: false,
  direct_redirect: false,
});

// All visits (the number the links list shows) and those in the recent window
const visitCount = ref(null);
const recentVisits = ref(null);
const recentDays = ref(30);
const loadingVisits = ref(false);

// Normalize icon: auto-prepend mdi- if needed
const normalizedIcon = computed(() => {
  const raw = form.icon?.trim();
  if (!raw) return "mdi-link-variant";
  if (raw.startsWith("mdi-")) return raw;
  return `mdi-${raw}`;
});

const iconWasNormalized = computed(() => {
  const raw = form.icon?.trim();
  return raw && !raw.startsWith("mdi-");
});

watch(
  () => props.model,
  async (model) => {
    form.title = model?.title || "";
    form.url = model?.url || "";
    form.description = model?.description || "";
    form.icon = model?.icon || "";
    form.category_id = model?.category_id || "";
    form.tags = (model?.tags || []).map((tag) => tag.name);
    form.newTagInput = "";
    form.is_public = Boolean(model?.is_public);
    form.direct_redirect = Boolean(model?.direct_redirect);

    // Load visit stats for existing links
    visitCount.value = null;
    recentVisits.value = null;
    if (model?.id) {
      loadingVisits.value = true;
      try {
        const data = await linkVisitsApi.getSummary({ linkId: model.id });
        visitCount.value =
          data?.stats?.all_time_visits ?? model.total_visits ?? 0;
        recentVisits.value = data?.stats?.total_visits ?? null;
        recentDays.value = data?.stats?.days ?? 30;
      } catch {
        visitCount.value = model.total_visits ?? 0;
      } finally {
        loadingVisits.value = false;
      }
    }
  },
  { immediate: true },
);

function addTag() {
  const input = form.newTagInput.trim();
  if (!input) return;
  const newTags = input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  for (const tag of newTags) {
    if (!form.tags.includes(tag)) {
      form.tags.push(tag);
    }
  }
  form.newTagInput = "";
}

function removeTag(index) {
  form.tags.splice(index, 1);
}

function handleTagKeydown(event) {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addTag();
  }
  if (event.key === "Backspace" && !form.newTagInput && form.tags.length) {
    form.tags.pop();
  }
}

function submit() {
  if (form.newTagInput.trim()) addTag();
  emit("save", {
    title: form.title,
    url: form.url,
    description: form.description,
    icon: form.icon?.trim() ? normalizedIcon.value : "",
    category_id: form.category_id || null,
    tags: form.tags,
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
      <div>
        <div class="flex items-center gap-2">
          <input
            v-model="form.icon"
            placeholder="Icon (e.g. wifi, mdi-wifi)"
            class="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
          />
          <i :class="normalizedIcon" class="mdi text-2xl text-brand-600"></i>
          <a
            title="Find icon names on pictogrammers.com (opens in a new tab)"
            href="https://pictogrammers.com/library/mdi/"
            target="_blank"
            class="text-xs text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap"
          >
            Browse icons →
          </a>
        </div>
        <p
          v-if="iconWasNormalized"
          class="text-xs text-brand-500 dark:text-brand-400 mt-1"
        >
          Will use
          <code class="bg-gray-100 dark:bg-brand-800 px-1 rounded-sm">{{
            normalizedIcon
          }}</code>
        </p>
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

      <!-- Tags input with pills -->
      <div>
        <div
          class="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800 min-h-[42px] cursor-text"
          @click="$refs.tagInput?.focus()"
        >
          <span
            v-for="(tag, index) in form.tags"
            :key="index"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 dark:bg-brand-700 text-brand-700 dark:text-brand-200 border border-brand-200 dark:border-brand-600"
          >
            {{ tag }}
            <button
              :title="`Remove tag ${tag}`" :aria-label="`Remove tag ${tag}`"
              type="button"
              class="text-brand-400 hover:text-brand-700 dark:hover:text-white leading-none"
              @click.stop="removeTag(index)"
            >
              ×
            </button>
          </span>
          <input
            ref="tagInput"
            v-model="form.newTagInput"
            placeholder="Add tags..."
            class="flex-1 min-w-[80px] bg-transparent border-none outline-hidden text-sm p-0"
            @keydown="handleTagKeydown"
            @blur="addTag"
          />
        </div>
        <p class="text-xs text-gray-400 dark:text-brand-500 mt-1">
          Press Enter or comma to add
        </p>
      </div>

      <label class="flex items-center gap-2 text-sm">
        <input v-model="form.is_public" type="checkbox" />
        Public link
      </label>
      <label v-if="form.is_public" class="flex items-center gap-2 text-sm">
        <input v-model="form.direct_redirect" type="checkbox" />
        Direct redirect
      </label>

      <!-- Visit stats (edit mode only) -->
      <p
        v-if="model?.id"
        class="text-xs text-gray-500 dark:text-brand-400"
      >
        <i class="mdi mdi-eye-outline mr-1"></i>
        <template v-if="loadingVisits">Loading visits...</template>
        <template v-else>
          {{ visitCount ?? 0 }} {{ visitCount === 1 ? "visit" : "visits" }} in total<template
            v-if="recentVisits !== null && recentVisits !== visitCount"
            >, {{ recentVisits }} in the last {{ recentDays }} days</template
          >
        </template>
      </p>

      <div class="flex justify-end gap-2 pt-2">
        <button
          title="Close without saving"
          type="button"
          class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          title="Save the link"
          type="submit"
          class="px-3 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        >
          Save
        </button>
      </div>
    </form>
  </BaseModal>
</template>
