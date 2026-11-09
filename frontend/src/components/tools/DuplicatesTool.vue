<script setup>
import { computed } from "vue";
import ToolLinkRow from "./ToolLinkRow.vue";
import { SMALL, TONES } from "./styles";
import { useAppStore } from "@/stores/app";
import { useDialogStore } from "@/stores/dialog";
import { linksApi } from "@/services/api/linksApi";
import { useToastStore } from "@/stores/toast";
import { findDuplicates } from "@/lib/shelfTools";

// Duplicates: links that point to the same page
const appStore = useAppStore();
const groups = computed(() => findDuplicates(appStore.allLinks));
const extra = computed(() => groups.value.reduce((n, g) => n + g.links.length - 1, 0));

// Keep one link of the group; the others go to the trash (restorable)
async function keepOnly(group, keep) {
  const others = group.links.filter((l) => l.id !== keep.id);
  const ok = await useDialogStore().confirm({
    title: `Keep "${keep.title}"?`,
    message: `The other ${others.length === 1 ? "link goes" : `${others.length} links go`} to the trash. You can restore ${others.length === 1 ? "it" : "them"} for 30 days.`,
    confirmText: "Keep this one",
    icon: "mdi-content-duplicate",
  });
  if (!ok) return;
  try {
    for (const link of others) await linksApi.remove(link.id);
    useToastStore().success(
      `Moved ${others.length} duplicate${others.length === 1 ? "" : "s"} to the trash`,
      {
        action: {
          label: "Undo",
          run: async () => {
            for (const link of others) await linksApi.restore(link.id);
            await appStore.refreshLinks();
          },
        },
        duration: 6000,
      },
    );
  } catch (error) {
    useToastStore().error(error.message || "Couldn't move them to the trash");
  }
  await appStore.refreshLinks();
}
</script>

<template>
  <div class="space-y-4" data-testid="duplicates-tool">
    <p v-if="!groups.length" class="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300" data-testid="duplicates-none">
      <i class="mdi mdi-check-circle-outline text-lg" aria-hidden="true"></i>
      No duplicates. Every link on your shelf points to a different page.
    </p>
    <template v-else>
      <p class="text-sm">
        <span class="px-2.5 py-1 rounded-full" :class="TONES.warn">
          {{ groups.length }} page{{ groups.length === 1 ? "" : "s" }} saved more than once
        </span>
        <span class="ml-2 text-gray-500 dark:text-brand-400">{{ extra }} link{{ extra === 1 ? "" : "s" }} could go.</span>
      </p>
      <section
        v-for="group in groups"
        :key="group.key"
        class="rounded-lg border border-gray-200 dark:border-brand-800 px-3"
        data-testid="duplicate-group"
      >
        <h3 class="pt-2.5 text-xs font-mono text-gray-500 dark:text-brand-400 break-all">{{ group.key }}</h3>
        <ul class="divide-y divide-gray-100 dark:divide-brand-800">
          <ToolLinkRow
            v-for="(link, i) in group.links"
            :key="link.id"
            :link="link"
            :note="i === 0 ? 'Saved first' : ''"
          >
            <button
              type="button"
              :class="SMALL"
              :title="`Keep this one and move the other ${group.links.length - 1} to the trash`"
              data-testid="duplicate-keep"
              @click="keepOnly(group, link)"
            >
              <i class="mdi mdi-check" aria-hidden="true"></i> Keep this one
            </button>
          </ToolLinkRow>
        </ul>
      </section>
    </template>
  </div>
</template>
