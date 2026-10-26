<script setup>
import { computed } from "vue";
import { useAppStore } from "@/stores/app";
import { useLinkMenu } from "@/composables/useLinkMenu";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/date";
import { usePublicShareStore } from "@/stores/publicShare";

const props = defineProps({
  link: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["edit", "delete"]);

const appStore = useAppStore();
const publicShare = usePublicShareStore();
// Right-click menu; its Edit opens the same editor as the Edit button
const linkMenu = useLinkMenu({ onEdit: (link) => emit("edit", link) });

const addedOn = computed(() => formatDate(props.link.created_at));

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
      <div class="flex items-center gap-3 text-sm shrink-0">
        <button
          class="-my-1 text-base leading-none"
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
          class="text-brand-600 dark:text-brand-400"
          :title="`Edit ${link.title}`"
          @click="$emit('edit', link)"
        >
          Edit
        </button>
        <button
          class="text-red-600 dark:text-red-400"
          :title="`Move ${link.title} to the trash`"
          @click="$emit('delete', link.id)"
        >
          Delete
        </button>
      </div>
    </div>

    <!-- The placeholder only costs height on phones, so it's sm+ only -->
    <!-- renderMarkdown escapes all HTML, so v-html is safe here -->
    <div
      v-if="link.description"
      class="md-content mt-1.5 sm:mt-2 text-sm text-gray-600 dark:text-brand-300 line-clamp-4"
      v-html="renderMarkdown(link.description)"
    ></div>
    <p
      v-else
      class="hidden sm:block mt-2 text-sm text-gray-400 dark:text-brand-500"
    >
      No description
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
      <!-- Quiet status icons; hover any of them for what it means -->
      <div
        class="flex items-center gap-2.5 justify-end text-xs text-gray-400 dark:text-brand-500 shrink-0"
      >
        <span v-if="addedOn" :title="`Added ${addedOn}`">{{ addedOn }}</span>
        <span
          v-if="link.is_public && link.total_visits > 0"
          :title="`${link.total_visits} ${link.total_visits === 1 ? 'visit' : 'visits'} in total`"
        >
          <i class="mdi mdi-eye-outline"></i> {{ link.total_visits }}
        </span>
        <i
          v-if="link.is_public && link.direct_redirect"
          class="mdi mdi-lightning-bolt text-sm"
          title="Direct redirect: the public link goes straight to the site"
          data-testid="redirect-indicator"
        ></i>
        <!-- Public: a labelled chip, so it reads as something to press.
             It opens the link to copy, with a QR code -->
        <button
          v-if="link.is_public"
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/60"
          title="Public link: copy it or show a QR code"
          data-testid="public-indicator"
          @click="publicShare.open(link)"
        >
          <i class="mdi mdi-earth" aria-hidden="true"></i>
          <span>Share</span>
          <i class="mdi mdi-qrcode" aria-hidden="true"></i>
        </button>
        <i
          v-else
          class="mdi mdi-lock-outline text-sm"
          title="Private: only you can see it"
          data-testid="private-indicator"
        ></i>
      </div>
    </div>
  </article>
</template>
