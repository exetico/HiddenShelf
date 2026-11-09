<script setup>
import { computed } from "vue";
import { useAppStore } from "@/stores/app";
import { useLinkMenu } from "@/composables/useLinkMenu";
import { formatDate } from "@/lib/date";
import { usePublicShareStore } from "@/stores/publicShare";

// One link as a single tight row, for the Edit page's list layout. It
// has the same information and actions as LinkCardEdit; the description
// is one plain line (wide screens only) and the actions are icons.
const props = defineProps({
  link: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["edit", "delete"]);

const appStore = useAppStore();
const publicShare = usePublicShareStore();
const linkMenu = useLinkMenu({ onEdit: (link) => emit("edit", link) });

const addedOn = computed(() => formatDate(props.link.created_at));
const tags = computed(() => props.link.tags || []);

const iconColor = computed(() => {
  if (!props.link.category_id) return "#3B82F6";
  const cat = appStore.categories.find((c) => c.id === props.link.category_id);
  return cat?.color || "#3B82F6";
});

// Markdown would be noise on one line: strip the marks, keep the words
const plainDescription = computed(() =>
  (props.link.description || "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>~]+/g, "")
    .replace(/\s+/g, " ")
    .trim(),
);
</script>

<template>
  <li
    class="flex items-center gap-2 px-2 sm:px-3 py-1.5 min-w-0 hover:bg-gray-50 dark:hover:bg-brand-800/50"
    data-testid="link-row-edit"
    :data-link-id="link.id"
    @contextmenu="linkMenu.open($event, link)"
  >
    <i
      :class="link.icon || 'mdi-link-variant'"
      class="mdi text-base leading-none shrink-0"
      :style="`color: ${iconColor}`"
      aria-hidden="true"
    ></i>

    <!-- Phones: title over the address. From sm: one line. -->
    <div class="min-w-0 flex-1 xl:flex-none xl:w-[42%] sm:flex sm:items-baseline sm:gap-2">
      <span
        class="block sm:shrink-0 sm:max-w-[45%] text-sm font-medium text-gray-900 dark:text-white truncate"
        :title="link.title"
        >{{ link.title }}</span
      >
      <span
        class="block min-w-0 sm:flex-1 text-xs text-gray-500 dark:text-brand-400 truncate"
        :title="link.url"
        >{{ link.url }}</span
      >
    </div>

    <span
      v-if="plainDescription"
      class="hidden xl:block min-w-0 flex-1 text-xs text-gray-500 dark:text-brand-400 truncate"
      :title="plainDescription"
      data-testid="row-description"
      >{{ plainDescription }}</span
    >
    <span v-else class="hidden xl:block flex-1" aria-hidden="true"></span>

    <div v-if="tags.length" class="hidden md:flex items-center gap-1 shrink-0">
      <button
        v-for="tag in tags.slice(0, 2)"
        :key="tag.id"
        type="button"
        class="max-w-[7rem] truncate px-1.5 py-px rounded-full text-xs bg-gray-100 dark:bg-brand-800 text-gray-600 dark:text-brand-300 hover:bg-brand-600 hover:text-white"
        :class="{
          'bg-brand-600! text-white!': appStore.filterTag === String(tag.id),
        }"
        :title="`Show links tagged ${tag.name}`"
        @click="appStore.filterByTag(tag.id)"
      >
        {{ tag.name }}
      </button>
      <span
        v-if="tags.length > 2"
        class="text-xs text-gray-400 dark:text-brand-500"
        :title="
          tags
            .slice(2)
            .map((t) => t.name)
            .join(', ')
        "
        >+{{ tags.length - 2 }}</span
      >
    </div>

    <!-- Status columns. Each has a fixed width and keeps its place when
         empty, so the columns line up from row to row: visits, redirect,
         share or lock, then the date. -->
    <div
      class="flex items-center gap-2 shrink-0 text-xs text-gray-400 dark:text-brand-500"
    >
      <span class="max-sm:hidden w-10 text-right whitespace-nowrap tabular-nums" data-testid="visits-slot">
        <span
          v-if="link.is_public && link.total_visits > 0"
          :title="`${link.total_visits} ${link.total_visits === 1 ? 'visit' : 'visits'} in total`"
          ><i class="mdi mdi-eye-outline"></i> {{ link.total_visits }}</span
        >
      </span>
      <span class="max-sm:hidden w-4 text-center" data-testid="redirect-slot">
        <i
          v-if="link.is_public && link.direct_redirect"
          class="mdi mdi-lightning-bolt text-sm"
          title="Direct redirect: the public link goes straight to the site"
          data-testid="redirect-indicator"
        ></i>
      </span>
      <button
        v-if="link.is_public"
        type="button"
        class="inline-flex items-center justify-center w-6 h-6 rounded-full border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/60"
        title="Public link: copy it, show a QR code or embed it"
        data-testid="public-indicator"
        @click="publicShare.open(link)"
      >
        <i class="mdi mdi-earth" aria-hidden="true"></i>
      </button>
      <span
        v-else
        class="inline-flex items-center justify-center w-6 h-6"
        title="Private: only you can see it"
        data-testid="private-indicator"
      >
        <i class="mdi mdi-lock-outline text-sm" aria-hidden="true"></i>
      </span>
      <span
        class="hidden lg:inline-block w-24 text-right whitespace-nowrap tabular-nums"
        data-testid="date-slot"
        :title="addedOn ? `Added ${addedOn}` : undefined"
        >{{ addedOn }}</span
      >
    </div>

    <div class="flex items-center shrink-0 text-base leading-none">
      <button
        class="w-7 h-7 inline-flex items-center justify-center rounded"
        :class="
          link.is_favorite
            ? 'text-amber-500'
            : 'text-gray-300 hover:text-amber-500 dark:text-brand-600'
        "
        :title="link.is_favorite ? 'Remove from favorites' : 'Add to favorites'"
        :aria-pressed="Boolean(link.is_favorite)"
        data-testid="favorite-toggle"
        @click="appStore.toggleLinkFavorite(link)"
      >
        <i class="mdi" :class="link.is_favorite ? 'mdi-star' : 'mdi-star-outline'"></i>
      </button>
      <button
        class="w-7 h-7 inline-flex items-center justify-center rounded text-brand-600 dark:text-brand-400 hover:bg-gray-100 dark:hover:bg-brand-800"
        :title="`Edit ${link.title}`"
        :aria-label="`Edit ${link.title}`"
        data-testid="edit-link"
        @click="$emit('edit', link)"
      >
        <i class="mdi mdi-pencil-outline" aria-hidden="true"></i>
      </button>
      <button
        class="w-7 h-7 inline-flex items-center justify-center rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
        :title="`Move ${link.title} to the trash`"
        :aria-label="`Move ${link.title} to the trash`"
        data-testid="trash-link"
        @click="$emit('delete', link.id)"
      >
        <i class="mdi mdi-delete-outline" aria-hidden="true"></i>
      </button>
    </div>
  </li>
</template>
