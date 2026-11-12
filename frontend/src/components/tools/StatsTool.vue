<script setup>
import { computed, ref } from "vue";
import ToolLinkRow from "./ToolLinkRow.vue";
import { SMALL } from "./styles";
import { useAppStore } from "@/stores/app";
import {
  addedPerMonth,
  mostOpened,
  neverOpened,
  ownLinks,
  shelfTotals,
  topSites,
} from "@/lib/shelfStats";
import { filterHref } from "@/lib/filterLinks";

// Shelf stats: everything here is worked out in the browser from the shelf
// the app already loaded. Only your own links count.
const appStore = useAppStore();
const mine = computed(() => ownLinks(appStore.allLinks));
const totals = computed(() => shelfTotals(mine.value));
const months = computed(() => addedPerMonth(mine.value));
const busiest = computed(() => Math.max(1, ...months.value.map((m) => m.count)));
const sites = computed(() => topSites(mine.value, 8));
const biggestSite = computed(() => Math.max(1, ...sites.value.map((s) => s.count)));
const unopened = computed(() => neverOpened(mine.value));
const opened = computed(() => mostOpened(mine.value));

const SHOW = 20;
const showAll = ref(false);
const shownUnopened = computed(() => (showAll.value ? unopened.value : unopened.value.slice(0, SHOW)));

const tiles = computed(() => [
  { label: "Links", value: totals.value.links, icon: "mdi-link-variant" },
  { label: "Added in 30 days", value: totals.value.addedLast30, icon: "mdi-calendar-plus" },
  { label: "To read", value: totals.value.toRead, icon: "mdi-book-clock-outline", href: filterHref("view", { toread: "1" }) },
  { label: "Public", value: totals.value.public, icon: "mdi-earth" },
]);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
</script>

<template>
  <div class="space-y-6" data-testid="stats-tool">
    <!-- Headline numbers -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <component
        :is="tile.href ? 'a' : 'div'"
        v-for="tile in tiles"
        :key="tile.label"
        :href="tile.href"
        :title="tile.href ? `Show the links ${tile.label.toLowerCase()}` : undefined"
        class="rounded-lg border border-gray-200 dark:border-brand-800 p-3"
        :class="tile.href ? 'hover:border-brand-400' : ''"
        :data-testid="`stat-${tile.label}`"
      >
        <p class="text-xs text-gray-500 dark:text-brand-400 flex items-center gap-1">
          <i class="mdi" :class="tile.icon" aria-hidden="true"></i>{{ tile.label }}
        </p>
        <p class="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{{ tile.value }}</p>
      </component>
    </div>

    <!-- Added per month: one series, so no legend; each bar says its value on hover -->
    <section aria-labelledby="stats-months">
      <h3 id="stats-months" class="text-sm font-semibold text-gray-800 dark:text-brand-100 mb-2">
        Links added per month
      </h3>
      <div
        class="flex items-end gap-0.5 h-32 mt-5 border-b border-gray-200 dark:border-brand-800"
        role="img"
        :aria-label="months.map((m) => `${m.label} ${m.year}: ${m.count}`).join(', ')"
        data-testid="stats-months"
      >
        <div
          v-for="m in months"
          :key="m.key"
          class="group relative flex-1 h-full flex items-end"
          :title="`${m.label} ${m.year}: ${plural(m.count, 'link')}`"
        >
          <div
            class="w-full rounded-t bg-brand-500 dark:bg-brand-400 group-hover:bg-brand-600 dark:group-hover:bg-brand-300 transition-colors"
            :style="{ height: m.count ? `${Math.max(4, (m.count / busiest) * 100)}%` : '0' }"
          ></div>
          <span
            v-if="m.count === busiest && m.count > 0 && months.filter((x) => x.count === busiest).length <= 2"
            class="absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-full text-[10px] text-gray-500 dark:text-brand-400 tabular-nums"
            >{{ m.count }}</span
          >
        </div>
      </div>
      <div class="flex gap-0.5 mt-1" aria-hidden="true">
        <span
          v-for="(m, i) in months"
          :key="m.key"
          class="flex-1 text-center text-[10px] text-gray-500 dark:text-brand-400"
          >{{ i % 2 === 1 || months.length <= 6 ? m.label : "" }}</span
        >
      </div>
    </section>

    <div class="grid gap-6 md:grid-cols-2">
      <!-- Top sites -->
      <section aria-labelledby="stats-sites">
        <h3 id="stats-sites" class="text-sm font-semibold text-gray-800 dark:text-brand-100 mb-2">
          Sites you save the most from
        </h3>
        <p v-if="!sites.length" class="text-sm text-gray-500 dark:text-brand-400">No links yet.</p>
        <ul v-else class="space-y-1.5" data-testid="stats-sites">
          <li v-for="s in sites" :key="s.site" class="text-sm">
            <a
              :href="filterHref('view', { q: s.site })"
              class="flex items-center justify-between gap-2 hover:underline"
              :title="`Show your links from ${s.site}`"
            >
              <span class="truncate font-mono text-xs text-gray-800 dark:text-brand-100">{{ s.site }}</span>
              <span class="tabular-nums text-gray-500 dark:text-brand-400">{{ s.count }}</span>
            </a>
            <div class="h-1 rounded-full bg-gray-100 dark:bg-brand-800 mt-0.5">
              <div class="h-1 rounded-full bg-brand-500 dark:bg-brand-400" :style="{ width: `${(s.count / biggestSite) * 100}%` }"></div>
            </div>
          </li>
        </ul>
      </section>

      <!-- Opened most -->
      <section aria-labelledby="stats-opened">
        <h3 id="stats-opened" class="text-sm font-semibold text-gray-800 dark:text-brand-100 mb-2">
          Links you open the most
        </h3>
        <p v-if="!opened.length" class="text-sm text-gray-500 dark:text-brand-400">
          Nothing yet. Open a few links from View and they show up here.
        </p>
        <ul v-else class="divide-y divide-gray-100 dark:divide-brand-800" data-testid="stats-opened">
          <ToolLinkRow
            v-for="link in opened"
            :key="link.id"
            :link="link"
            :note="`Opened ${plural(link.open_count, 'time')}`"
          />
        </ul>
      </section>
    </div>

    <!-- Never opened -->
    <section aria-labelledby="stats-unopened">
      <h3 id="stats-unopened" class="text-sm font-semibold text-gray-800 dark:text-brand-100">
        Links you never open
        <span class="font-normal text-gray-500 dark:text-brand-400">({{ unopened.length }})</span>
      </h3>
      <p class="text-xs text-gray-500 dark:text-brand-400 mb-2">
        Saved over 30 days ago and not opened from Hidden Shelf since. Opens are
        counted from this version on, so give it a while before you clear any
        out.
      </p>
      <p v-if="!unopened.length" class="text-sm text-emerald-700 dark:text-emerald-300" data-testid="stats-unopened-none">
        <i class="mdi mdi-check-circle-outline" aria-hidden="true"></i>
        You use everything on your shelf.
      </p>
      <ul v-else class="divide-y divide-gray-100 dark:divide-brand-800" data-testid="stats-unopened">
        <ToolLinkRow v-for="link in shownUnopened" :key="link.id" :link="link" />
      </ul>
      <button
        title="Show every link you never open"
        v-if="unopened.length > SHOW && !showAll"
        type="button"
        :class="[SMALL, 'mt-2']"
        @click="showAll = true"
      >
        Show all {{ unopened.length }}
      </button>
    </section>
  </div>
</template>
