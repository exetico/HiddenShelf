<script setup>
import { computed } from "vue";
import ToolLinkRow from "./ToolLinkRow.vue";
import { OUTLINE, PRIMARY, SMALL, TONES } from "./styles";
import { useAppStore } from "@/stores/app";
import { useLinkCheckStore } from "@/stores/linkCheck";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { ownLinks } from "@/lib/shelfTools";

// Check links: the server asks each site if the page is still there
const appStore = useAppStore();
const check = useLinkCheckStore();
const editor = useLinkEditorStore();

const own = computed(() => ownLinks(appStore.allLinks));
const byId = computed(() => new Map(own.value.map((l) => [l.id, l])));

// Results for links still on the shelf, in shelf order
function withStatus(status) {
  return Object.values(check.results)
    .filter((r) => r.status === status && byId.value.has(r.id))
    .map((r) => ({ result: r, link: byId.value.get(r.id) }));
}
const broken = computed(() => withStatus("broken"));
const moved = computed(() => withStatus("moved"));
const unsure = computed(() => withStatus("unsure"));
const progress = computed(() => (check.total ? Math.round((check.done / check.total) * 100) : 0));

const checkedWhen = computed(() => {
  if (!check.checkedAt) return "";
  const minutes = Math.round((Date.now() - check.checkedAt) / 60000);
  return minutes < 1 ? "just now" : `${minutes} min ago`;
});

async function useNewAddress({ link, result }) {
  await appStore.updateLink(link.id, { url: result.final_url });
  check.clear(link.id);
}
async function trash(link) {
  if (await appStore.trashLink(link)) check.clear(link.id);
}
async function fixAllMoved() {
  for (const item of moved.value) await useNewAddress(item);
}
</script>

<template>
  <div class="space-y-4" data-testid="check-tool">
    <div class="flex flex-wrap items-center gap-3">
      <button
        v-if="!check.running"
        type="button"
        :class="PRIMARY"
        :disabled="!own.length"
        title="Check every link on your shelf"
        data-testid="check-start"
        @click="check.run(appStore.allLinks)"
      >
        <i class="mdi mdi-play" aria-hidden="true"></i>
        {{ check.hasRun ? "Check again" : `Check ${own.length} links` }}
      </button>
      <button v-else type="button" :class="OUTLINE" title="Stop after this batch" @click="check.stop()">
        <i class="mdi mdi-stop" aria-hidden="true"></i> Stop
      </button>
      <p v-if="check.running" class="text-sm text-gray-600 dark:text-brand-300" aria-live="polite">
        Checking {{ check.done }} of {{ check.total }}…
      </p>
      <p v-else-if="check.checkedAt" class="text-sm text-gray-500 dark:text-brand-400">
        Checked {{ check.done }} links {{ checkedWhen }}.
      </p>
    </div>

    <div
      v-if="check.running"
      class="h-1.5 rounded-full bg-gray-100 dark:bg-brand-800 overflow-hidden"
      role="progressbar"
      :aria-valuenow="progress"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="h-full bg-brand-500 transition-all duration-300" :style="{ width: `${progress}%` }"></div>
    </div>

    <p v-if="check.error" class="text-sm text-red-600 dark:text-red-400" data-testid="check-error">
      {{ check.error }}
    </p>

    <!-- Summary chips -->
    <ul v-if="check.hasRun" class="flex flex-wrap gap-2 text-sm" data-testid="check-summary">
      <li class="px-2.5 py-1 rounded-full" :class="TONES.good">
        <i class="mdi mdi-check-circle-outline" aria-hidden="true"></i> {{ check.counts.ok }} working
      </li>
      <li class="px-2.5 py-1 rounded-full" :class="broken.length ? TONES.bad : TONES.quiet">
        <i class="mdi mdi-link-variant-off" aria-hidden="true"></i> {{ broken.length }} broken
      </li>
      <li class="px-2.5 py-1 rounded-full" :class="moved.length ? TONES.warn : TONES.quiet">
        <i class="mdi mdi-arrow-right-bold-circle-outline" aria-hidden="true"></i> {{ moved.length }} moved
      </li>
      <li class="px-2.5 py-1 rounded-full" :class="TONES.quiet">
        <i class="mdi mdi-help-circle-outline" aria-hidden="true"></i> {{ unsure.length }} couldn't tell
      </li>
      <li v-if="check.counts.skipped" class="px-2.5 py-1 rounded-full" :class="TONES.quiet" title="Links on your own network (like 192.168.x.x or nas.lan) aren't checked from the server">
        <i class="mdi mdi-home-outline" aria-hidden="true"></i> {{ check.counts.skipped }} on your network, not checked
      </li>
    </ul>

    <section v-if="broken.length" data-testid="check-broken">
      <h3 class="text-sm font-semibold text-red-700 dark:text-red-300">Broken</h3>
      <p class="text-xs text-gray-500 dark:text-brand-400">The page is gone or the site no longer exists.</p>
      <ul class="divide-y divide-gray-100 dark:divide-brand-800">
        <ToolLinkRow
          v-for="item in broken"
          :key="item.link.id"
          :link="item.link"
          :note="item.result.reason"
          note-tone="text-red-700 dark:text-red-300"
        >
          <button type="button" :class="SMALL" title="Change this link" @click="editor.open(item.link)">
            <i class="mdi mdi-pencil-outline" aria-hidden="true"></i> Edit
          </button>
          <button type="button" :class="SMALL" title="Move this link to the trash" @click="trash(item.link)">
            <i class="mdi mdi-delete-outline" aria-hidden="true"></i> Trash
          </button>
        </ToolLinkRow>
      </ul>
    </section>

    <section v-if="moved.length" data-testid="check-moved">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-amber-800 dark:text-amber-200">Moved</h3>
          <p class="text-xs text-gray-500 dark:text-brand-400">
            The site says these pages have a new address for good. Your links still work, through a redirect.
          </p>
        </div>
        <button v-if="1 < moved.length" type="button" :class="SMALL" title="Save the new address on every moved link" @click="fixAllMoved">
          <i class="mdi mdi-auto-fix" aria-hidden="true"></i> Update all {{ moved.length }}
        </button>
      </div>
      <ul class="divide-y divide-gray-100 dark:divide-brand-800">
        <ToolLinkRow v-for="item in moved" :key="item.link.id" :link="item.link" :note="`Now at ${item.result.final_url}`">
          <button type="button" :class="SMALL" title="Save the new address on this link" data-testid="check-use-new" @click="useNewAddress(item)">
            <i class="mdi mdi-check" aria-hidden="true"></i> Use new address
          </button>
        </ToolLinkRow>
      </ul>
    </section>

    <details v-if="unsure.length" class="group" data-testid="check-unsure">
      <summary class="cursor-pointer text-sm font-semibold text-gray-700 dark:text-brand-200">
        Couldn't tell ({{ unsure.length }})
      </summary>
      <p class="text-xs text-gray-500 dark:text-brand-400 mt-1">
        Sites that need a sign-in, block automatic checks, or didn't answer. Open them to see for yourself.
      </p>
      <ul class="divide-y divide-gray-100 dark:divide-brand-800">
        <ToolLinkRow v-for="item in unsure" :key="item.link.id" :link="item.link" :note="item.result.reason">
          <button type="button" :class="SMALL" title="Change this link" @click="editor.open(item.link)">
            <i class="mdi mdi-pencil-outline" aria-hidden="true"></i> Edit
          </button>
        </ToolLinkRow>
      </ul>
    </details>

    <p
      v-if="check.checkedAt && !check.running && !broken.length && !moved.length && !check.error"
      class="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"
      data-testid="check-all-good"
    >
      <i class="mdi mdi-party-popper text-lg" aria-hidden="true"></i> Nothing broken. Your shelf is in good shape.
    </p>
  </div>
</template>
