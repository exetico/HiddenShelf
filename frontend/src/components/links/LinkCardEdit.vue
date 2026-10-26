<script setup>
import { computed } from "vue";
import { useAppStore } from "@/stores/app";
import { useLinkMenu } from "@/composables/useLinkMenu";

const props = defineProps({
  link: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["edit", "delete", "copyPublic"]);

const appStore = useAppStore();
// Right-click menu; its Edit opens the same editor as the Edit button
const linkMenu = useLinkMenu({ onEdit: (link) => emit("edit", link) });

const iconColor = computed(() => {
  if (!props.link.category_id) return "#3B82F6";
  const cat = appStore.categories.find((c) => c.id === props.link.category_id);
  return cat?.color || "#3B82F6";
});
</script>

<template>
  <article
    class="bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 rounded-lg p-3 sm:p-4 min-w-0"
    @contextmenu="linkMenu.open($event, link)"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2 min-w-0 flex-1">
        <i
          :class="link.icon || 'mdi-link-variant'"
          class="mdi text-lg mt-0.5 shrink-0"
          :style="`color: ${iconColor}`"
        ></i>
        <div class="min-w-0">
          <h3
            class="font-semibold text-gray-900 dark:text-white truncate"
            :title="link.title"
          >
            {{ link.title }}
          </h3>
          <p
            class="text-xs text-gray-500 dark:text-brand-400 truncate"
            :title="link.url"
          >
            {{ link.url }}
          </p>
        </div>
      </div>
      <div class="flex gap-3 text-sm shrink-0">
        <button
          class="text-brand-600 dark:text-brand-400"
          :title="`Edit ${link.title}`"
          @click="$emit('edit', link)"
        >
          Edit
        </button>
        <button
          class="text-red-600 dark:text-red-400"
          :title="`Delete ${link.title}`"
          @click="$emit('delete', link.id)"
        >
          Delete
        </button>
      </div>
    </div>

    <!-- The placeholder only costs height on phones, so it's sm+ only -->
    <p
      class="mt-1.5 sm:mt-2 text-sm text-gray-600 dark:text-brand-300"
      :class="{ 'hidden sm:block': !link.description }"
    >
      {{ link.description || "No description" }}
    </p>

    <div class="mt-2 sm:mt-3 flex items-center justify-between">
      <div class="flex flex-wrap gap-1">
        <button
          v-for="tag in (link.tags || []).slice(0, 3)"
          :key="tag.id"
          type="button"
          class="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-brand-800 text-gray-600 dark:text-brand-300 hover:bg-brand-600 hover:text-white"
          :class="{
            'bg-brand-600! text-white!': appStore.filterTag === String(tag.id),
          }"
          :title="`Show links tagged ${tag.name}`"
          @click="appStore.filterByTag(tag.id)"
        >
          {{ tag.name }}
        </button>
        <span
          v-if="(link.tags || []).length > 3"
          class="px-1 py-0.5 text-xs text-gray-400 dark:text-brand-500"
          :title="
            link.tags
              .slice(3)
              .map((t) => t.name)
              .join(', ')
          "
          >+{{ link.tags.length - 3 }}</span
        >
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <!-- Direct redirect indicator -->
        <span
          v-if="link.direct_redirect"
          class="text-xs px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
          title="Direct redirect enabled"
        >
          <i class="mdi mdi-lightning-bolt"></i> redirect
        </span>
        <!-- Visit count for public links -->
        <span
          v-if="link.is_public && link.total_visits > 0"
          class="text-xs text-gray-400 dark:text-brand-500"
          :title="`${link.total_visits} ${link.total_visits === 1 ? 'visit' : 'visits'} in total`"
        >
          <i class="mdi mdi-eye-outline"></i> {{ link.total_visits }}
        </span>
        <span
          class="text-xs text-gray-400 dark:text-brand-500"
          :title="link.is_public ? 'Public link' : 'Private link'"
        >
          {{ link.is_public ? "🔓" : "🔒" }}
        </span>
        <button
          v-if="link.is_public"
          class="text-xs text-green-600 dark:text-green-400"
          title="Copy the public link to the clipboard"
          @click="$emit('copyPublic', link.hash)"
        >
          Copy public URL
        </button>
      </div>
    </div>
  </article>
</template>
