<script setup>
import { computed, ref, watch, onUnmounted } from "vue";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { useLinkDetailsStore } from "@/stores/linkDetails";
import { useLinkMenu } from "@/composables/useLinkMenu";
import { renderMarkdown } from "@/lib/markdown";
import { appUrl } from "@/lib/appUrl";

// Everything about one link, with previous/next (buttons, swipe or arrow
// keys) through the links on screen. See stores/linkDetails.js.
const details = useLinkDetailsStore();
const appStore = useAppStore();
const toast = useToastStore();
const linkMenu = useLinkMenu();

const link = computed(() => details.current);
const direction = ref("next"); // which way the slide animation goes

const category = computed(() => {
  const id = link.value?.category_id;
  if (!id) return null;
  return [...appStore.categories, ...appStore.sharedCategories].find(
    (c) => c.id === id,
  );
});

const addedOn = computed(() => {
  const value = link.value?.created_at;
  if (!value) return "";
  return new Date(value.replace(" ", "T")).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
});

function go(step) {
  direction.value = step > 0 ? "next" : "prev";
  if (step > 0) details.next();
  else details.prev();
}

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
}

// The menu's actions (edit, move, delete) change the list, so the sheet
// steps aside first
function openMenu(event, current) {
  details.close();
  linkMenu.open(event, current);
}

function showTag(tag) {
  details.close();
  appStore.filterByTag(tag.id);
}

// Swipe left/right on phones
let touchStart = null;
function onTouchStart(event) {
  const t = event.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}
function onTouchEnd(event) {
  if (!touchStart) return;
  const t = event.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 60 && Math.abs(dy) < 60) go(dx < 0 ? 1 : -1);
}

function onKeydown(event) {
  if (event.key === "Escape") details.close();
  else if (event.key === "ArrowRight") go(1);
  else if (event.key === "ArrowLeft") go(-1);
}

watch(
  () => Boolean(link.value),
  (open) => {
    window.removeEventListener("keydown", onKeydown);
    if (open) window.addEventListener("keydown", onKeydown);
  },
);
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="link"
      role="dialog"
      aria-modal="true"
      :aria-label="`Details for ${link.title}`"
      class="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      data-testid="link-details"
      @click.self="details.close()"
    >
      <div
        class="w-full sm:max-w-lg max-h-[85dvh] flex flex-col bg-white dark:bg-brand-900 rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 dark:border-brand-800 overflow-hidden"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <!-- Previous / position / next / close -->
        <header
          class="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-brand-800 text-gray-500 dark:text-brand-400"
        >
          <button
            type="button"
            class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-brand-800 disabled:opacity-30"
            title="Previous link"
            aria-label="Previous link"
            :disabled="!details.hasPrev"
            @click="go(-1)"
          >
            <i class="mdi mdi-chevron-left text-xl leading-none"></i>
          </button>
          <span class="text-xs tabular-nums" data-testid="details-position">
            {{ details.index + 1 }} of {{ details.links.length }}
          </span>
          <button
            type="button"
            class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-brand-800 disabled:opacity-30"
            title="Next link"
            aria-label="Next link"
            :disabled="!details.hasNext"
            @click="go(1)"
          >
            <i class="mdi mdi-chevron-right text-xl leading-none"></i>
          </button>
          <span class="flex-1"></span>
          <button
            type="button"
            class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-brand-800"
            title="Close"
            aria-label="Close"
            @click="details.close()"
          >
            <i class="mdi mdi-close text-xl leading-none"></i>
          </button>
        </header>

        <Transition
          mode="out-in"
          :enter-from-class="direction === 'next' ? 'translate-x-6 opacity-0' : '-translate-x-6 opacity-0'"
          enter-active-class="transition duration-150 ease-out"
          leave-active-class="transition duration-100 ease-in"
          :leave-to-class="direction === 'next' ? '-translate-x-6 opacity-0' : 'translate-x-6 opacity-0'"
        >
          <section :key="link.id" class="overflow-y-auto p-4 space-y-3">
            <div class="flex items-start gap-3">
              <i
                :class="link.icon || 'mdi-link-variant'"
                class="mdi text-2xl leading-none mt-0.5"
                :style="`color: ${category?.color || '#3B82F6'}`"
                aria-hidden="true"
              ></i>
              <div class="min-w-0">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ link.title }}
                </h2>
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener"
                  class="text-sm text-brand-600 dark:text-brand-300 break-all hover:underline"
                  :title="`Open ${link.url} in a new tab`"
                  >{{ link.url }}</a
                >
              </div>
            </div>

            <!-- renderMarkdown escapes all HTML, so v-html is safe here -->
            <div
              v-if="link.description"
              class="md-content text-sm text-gray-700 dark:text-brand-200"
              v-html="renderMarkdown(link.description)"
            ></div>
            <p v-else class="text-sm text-gray-400 dark:text-brand-500">
              No description
            </p>

            <div class="flex flex-wrap items-center gap-1.5 text-xs">
              <span
                v-if="category"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-brand-800"
              >
                <i
                  :class="category.icon || 'mdi-folder'"
                  class="mdi"
                  :style="`color: ${category.color || '#6B7280'}`"
                  aria-hidden="true"
                ></i>
                {{ category.name }}
              </span>
              <button
                v-for="tag in link.tags || []"
                :key="tag.id"
                type="button"
                class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-brand-800 hover:bg-brand-600 hover:text-white"
                :title="`Show links tagged ${tag.name}`"
                @click="showTag(tag)"
              >
                #{{ tag.name }}
              </button>
            </div>

            <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-brand-400">
              <span>
                <i class="mdi" :class="link.is_public ? 'mdi-lock-open-outline' : 'mdi-lock-outline'" aria-hidden="true"></i>
                {{ link.is_public ? "Public" : "Private" }}
              </span>
              <span v-if="link.direct_redirect">
                <i class="mdi mdi-lightning-bolt" aria-hidden="true"></i> Direct redirect
              </span>
              <span v-if="link.is_public">
                <i class="mdi mdi-eye-outline" aria-hidden="true"></i>
                {{ link.total_visits || 0 }} {{ link.total_visits === 1 ? "visit" : "visits" }}
              </span>
              <span v-if="addedOn">Added {{ addedOn }}</span>
            </p>
          </section>
        </Transition>

        <footer
          class="flex flex-wrap gap-2 p-3 border-t border-gray-200 dark:border-brand-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <a
            :href="link.url"
            target="_blank"
            rel="noopener"
            class="flex-1 min-w-28 text-center px-3 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700 text-sm"
            title="Open the link in a new tab"
          >
            <i class="mdi mdi-open-in-new" aria-hidden="true"></i> Open
          </a>
          <button
            type="button"
            class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 text-sm"
            title="Copy the URL"
            @click="copy(link.url, 'URL copied')"
          >
            <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy
          </button>
          <button
            v-if="link.is_public && link.hash"
            type="button"
            class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 text-sm"
            title="Copy the public short link"
            @click="copy(appUrl(`/h/${link.hash}`), 'Public link copied')"
          >
            <i class="mdi mdi-link-variant" aria-hidden="true"></i> Public link
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 text-sm"
            title="More actions: edit, move, delete"
            aria-label="More actions"
            @click="openMenu($event, link)"
          >
            <i class="mdi mdi-dots-horizontal" aria-hidden="true"></i>
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
