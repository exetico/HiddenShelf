<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import DuplicatesTool from "@/components/tools/DuplicatesTool.vue";
import TidyTool from "@/components/tools/TidyTool.vue";
import AddManyTool from "@/components/tools/AddManyTool.vue";
import BookmarksTool from "@/components/tools/BookmarksTool.vue";
import ShareListTool from "@/components/tools/ShareListTool.vue";
import QrTool from "@/components/tools/QrTool.vue";
import InspectTool from "@/components/tools/InspectTool.vue";
import { ACCENTS, TONES } from "@/components/tools/styles";
import { useAppStore } from "@/stores/app";
import { TOOLS, TOOL_GROUPS, toolFor, toolQuery } from "@/lib/urlTools";
import { findDuplicates, tidyReport } from "@/lib/shelfTools";

// The Tools page: an overview of every tool, and the open tool (?tool=).
// Every tool runs in the browser; the server only saves what you choose to.
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const COMPONENTS = {
  duplicates: DuplicatesTool,
  tidy: TidyTool,
  "add-many": AddManyTool,
  bookmarks: BookmarksTool,
  "share-list": ShareListTool,
  qr: QrTool,
  inspect: InspectTool,
};

const toolsIn = (group) => TOOLS.filter((t) => t.group === group);
const active = computed(() => toolFor(route.query.tool));
function open(key) {
  router.push({ name: "tools", query: toolQuery(key) });
}


// What each shelf tool has found, for its card
const insights = computed(() => {
  if (!appStore.linksLoaded) return {};
  const dupes = findDuplicates(appStore.allLinks);
  const report = tidyReport(appStore.allLinks);
  const toTidy = new Set(Object.values(report).flat().map((l) => l.id)).size;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return {
    duplicates: dupes.length
      ? { text: `${plural(dupes.length, "page")} saved twice or more`, tone: "warn" }
      : { text: "No duplicates", tone: "good" },
    tidy: toTidy
      ? { text: `${plural(toTidy, "link")} to look at`, tone: "warn" }
      : { text: "All tidy", tone: "good" },
  };
});
</script>

<template>
  <section class="space-y-5" data-testid="tools-page">
    <!-- Overview -->
    <template v-if="!active">
      <header
        class="relative overflow-hidden rounded-xl border border-gray-200 dark:border-brand-800 bg-white dark:bg-brand-900 bg-linear-to-br from-transparent from-40% to-brand-500/15 p-5 sm:p-6"
      >
        <i
          class="mdi mdi-toolbox-outline pointer-events-none absolute -right-4 -bottom-8 text-[9rem] leading-none text-brand-500 opacity-15 dark:opacity-20 -rotate-12"
          aria-hidden="true"
        ></i>
        <h1 class="relative text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Tools</h1>
        <p class="relative mt-1 max-w-xl text-sm sm:text-base text-gray-600 dark:text-brand-300">
          Keep your shelf in shape and move links in and out of it. Every
          tool runs in your browser: only what you choose to save goes to
          your shelf.
        </p>
      </header>

      <div v-for="group in TOOL_GROUPS" :key="group.key" class="space-y-2">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-brand-400">
          {{ group.label }}
        </h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="tool in toolsIn(group.key)"
            :key="tool.key"
            type="button"
            class="group relative overflow-hidden text-left rounded-xl border border-gray-200 dark:border-brand-800 bg-white dark:bg-brand-900 bg-linear-to-br from-transparent from-50% p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-brand-400 dark:hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500"
            :class="ACCENTS[tool.accent].glow"
            :title="tool.hint"
            :data-testid="`tool-card-${tool.key}`"
            @click="open(tool.key)"
          >
            <i
              class="mdi pointer-events-none absolute -right-3 -bottom-5 text-7xl leading-none opacity-10 dark:opacity-15 -rotate-12 transition-transform duration-300 group-hover:-rotate-6"
              :class="[tool.icon, ACCENTS[tool.accent].art]"
              aria-hidden="true"
            ></i>
            <span class="relative flex items-start gap-3">
              <span class="grid place-items-center shrink-0 w-10 h-10 rounded-lg text-xl" :class="ACCENTS[tool.accent].tile">
                <i class="mdi" :class="tool.icon" aria-hidden="true"></i>
              </span>
              <span class="min-w-0">
                <span class="block font-semibold text-gray-900 dark:text-white">{{ tool.label }}</span>
                <span class="block text-sm text-gray-600 dark:text-brand-300">{{ tool.hint }}.</span>
              </span>
            </span>
            <span class="relative mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                v-if="insights[tool.key]"
                class="px-2 py-0.5 rounded-full font-medium"
                :class="TONES[insights[tool.key].tone]"
                :data-testid="`tool-insight-${tool.key}`"
              >
                {{ insights[tool.key].text }}
              </span>
              <span v-else class="text-gray-500 dark:text-brand-400">
                <i class="mdi mdi-shield-lock-outline" aria-hidden="true"></i> Runs in your browser
              </span>
            </span>
          </button>
        </div>
      </div>
    </template>

    <!-- One tool -->
    <template v-else>
      <!-- A small pill on its own line, with the page's usual gap below
           it, so it never sits on the tool's card -->
      <nav aria-label="Tools">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full text-sm border border-gray-200 dark:border-brand-800 bg-white dark:bg-brand-900 text-gray-700 dark:text-brand-200 hover:border-brand-400 dark:hover:border-brand-600 hover:text-gray-900 dark:hover:text-white transition-colors"
          title="Back to all tools"
          data-testid="tools-back"
          @click="open('')"
        >
          <i class="mdi mdi-arrow-left" aria-hidden="true"></i> All tools
        </button>
      </nav>

      <article
        class="bg-white dark:bg-brand-900 rounded-xl border border-gray-200 dark:border-brand-800 overflow-hidden"
        :aria-label="active.label"
        :data-testid="`tool-${active.key}`"
      >
        <header
          class="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 border-b border-gray-100 dark:border-brand-800 bg-white dark:bg-brand-900 bg-linear-to-br from-transparent from-50%"
          :class="ACCENTS[active.accent].glow"
        >
          <span class="grid place-items-center shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl text-2xl" :class="ACCENTS[active.accent].tile">
            <i class="mdi" :class="active.icon" aria-hidden="true"></i>
          </span>
          <div class="min-w-0">
            <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{{ active.label }}</h1>
            <p class="mt-0.5 text-sm text-gray-600 dark:text-brand-300 max-w-2xl" data-testid="tool-description">
              {{ active.description }}
            </p>
            <p class="mt-1.5 text-xs text-gray-500 dark:text-brand-400">
              <i class="mdi mdi-shield-lock-outline" aria-hidden="true"></i>
              Runs in your browser. Only what you choose to save goes to your shelf.
            </p>
          </div>
        </header>
        <div class="p-4 sm:p-5">
          <KeepAlive>
            <component :is="COMPONENTS[active.key]" :key="active.key" />
          </KeepAlive>
        </div>
      </article>
    </template>
  </section>
</template>
