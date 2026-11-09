<script setup>
import { computed, ref } from "vue";
import ToolLinkRow from "./ToolLinkRow.vue";
import { SMALL } from "./styles";
import { useAppStore } from "@/stores/app";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { useToastStore } from "@/stores/toast";
import { linksApi } from "@/services/api/linksApi";
import { TIDY_CHECKS, tidyReport, titleFromUrl } from "@/lib/shelfTools";
import { cleanTracking } from "@/lib/urlTools";

// Tidy up: links that would be easier to find with a little care
const appStore = useAppStore();
const editor = useLinkEditorStore();
const report = computed(() => tidyReport(appStore.allLinks));

// The check whose links are listed; starts on the first with any
const picked = ref("");
const active = computed(
  () => picked.value || TIDY_CHECKS.find((c) => report.value[c.key].length)?.key || TIDY_CHECKS[0].key,
);
const check = computed(() => TIDY_CHECKS.find((c) => c.key === active.value));
const list = computed(() => report.value[active.value]);
const LIMIT = 50;
const showAll = ref(false);
const shown = computed(() => (showAll.value ? list.value : list.value.slice(0, LIMIT)));
function pick(key) {
  picked.value = key;
  showAll.value = false;
}

const busy = ref(false);
async function save(link, payload) {
  await linksApi.update(link.id, payload);
}
async function cleanOne(link) {
  busy.value = true;
  try {
    await save(link, { url: cleanTracking(link.url).url });
    await appStore.refreshLinks();
    useToastStore().success("Tracking removed");
  } catch (error) {
    useToastStore().error(error.message);
  } finally {
    busy.value = false;
  }
}
async function cleanAll() {
  busy.value = true;
  const links = [...list.value];
  let done = 0;
  try {
    for (const link of links) {
      await save(link, { url: cleanTracking(link.url).url });
      done++;
    }
    useToastStore().success(`Removed tracking from ${done} link${done === 1 ? "" : "s"}`);
  } catch (error) {
    useToastStore().error(`${done} cleaned, then: ${error.message}`);
  } finally {
    busy.value = false;
    await appStore.refreshLinks();
  }
}
async function useTitle(link) {
  busy.value = true;
  try {
    await save(link, { title: titleFromUrl(link.url) });
    await appStore.refreshLinks();
  } catch (error) {
    useToastStore().error(error.message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="space-y-4" data-testid="tidy-tool">
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label="What to tidy">
      <button
        v-for="item in TIDY_CHECKS"
        :key="item.key"
        type="button"
        role="tab"
        :aria-selected="active === item.key"
        :title="item.hint"
        class="text-left rounded-lg border p-2.5 transition-colors"
        :class="
          active === item.key
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-800/60'
            : 'border-gray-200 dark:border-brand-800 hover:border-brand-400'
        "
        :data-testid="`tidy-tab-${item.key}`"
        @click="pick(item.key)"
      >
        <span class="flex items-center justify-between gap-1">
          <i class="mdi text-lg text-gray-500 dark:text-brand-300" :class="item.icon" aria-hidden="true"></i>
          <span class="text-xl font-bold" :class="report[item.key].length ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-brand-500'">
            {{ report[item.key].length }}
          </span>
        </span>
        <span class="block text-xs sm:text-sm text-gray-700 dark:text-brand-200 leading-tight mt-1">{{ item.label }}</span>
      </button>
    </div>

    <div role="tabpanel" :data-testid="`tidy-${active}`">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="text-sm text-gray-600 dark:text-brand-300">{{ check.hint }}</p>
        <button
          v-if="active === 'tracking' && 1 < list.length"
          type="button"
          :class="SMALL"
          :disabled="busy"
          title="Take tracking off every link in this list"
          data-testid="tidy-clean-all"
          @click="cleanAll"
        >
          <i class="mdi mdi-broom" aria-hidden="true"></i> Clean all {{ list.length }}
        </button>
      </div>
      <p v-if="!list.length" class="mt-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
        <i class="mdi mdi-check-circle-outline text-lg" aria-hidden="true"></i> Nothing here. Nicely done.
      </p>
      <ul v-else class="divide-y divide-gray-100 dark:divide-brand-800">
        <ToolLinkRow
          v-for="link in shown"
          :key="link.id"
          :link="link"
          :note="
            active === 'tracking'
              ? `Removes ${cleanTracking(link.url).removed.join(', ')}`
              : active === 'plain-title'
                ? `Suggested: ${titleFromUrl(link.url)}`
                : ''
          "
        >
          <button v-if="active === 'tracking'" type="button" :class="SMALL" :disabled="busy" title="Take the tracking off this address" @click="cleanOne(link)">
            <i class="mdi mdi-broom" aria-hidden="true"></i> Clean
          </button>
          <button v-if="active === 'plain-title'" type="button" :class="SMALL" :disabled="busy" title="Use the suggested title" @click="useTitle(link)">
            <i class="mdi mdi-check" aria-hidden="true"></i> Use it
          </button>
          <button type="button" :class="SMALL" :title="active === 'uncategorized' ? 'Pick a category for this link' : active === 'untagged' ? 'Add tags to this link' : 'Change this link'" @click="editor.open(link)">
            <i class="mdi mdi-pencil-outline" aria-hidden="true"></i>
            {{ active === "uncategorized" ? "Pick category" : active === "untagged" ? "Add tags" : "Edit" }}
          </button>
        </ToolLinkRow>
      </ul>
      <button
        v-if="LIMIT < list.length && !showAll"
        type="button"
        class="mt-2 text-sm text-brand-600 dark:text-brand-300 hover:underline"
        title="Show the whole list"
        @click="showAll = true"
      >
        Show all {{ list.length }}
      </button>
    </div>
  </div>
</template>
