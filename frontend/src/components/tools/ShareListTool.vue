<script setup>
import { computed, ref } from "vue";
import { INPUT, OUTLINE, PRIMARY } from "./styles";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { LIST_FORMATS, formatList } from "@/lib/shareList";
import { downloadText } from "@/lib/download";
import { favoriteLinks, sortLinks } from "@/lib/shelf";

// Copy as a list: a category, a tag or your favorites as text to paste
const appStore = useAppStore();
const toast = useToastStore();

// "cat:ID", "tag:ID", "favorites" or "uncategorized"
const source = ref("");
const format = ref("markdown");
const descriptions = ref(false);
const withHeading = ref(true);

const sources = computed(() => [
  ...(appStore.favoriteLinks.length ? [{ value: "favorites", label: `Favorites (${appStore.favoriteLinks.length})` }] : []),
  ...[...appStore.categories, ...appStore.sharedCategories]
    .map((c) => ({ c, n: appStore.allLinks.filter((l) => l.category_id === c.id).length }))
    .filter(({ n }) => n)
    .map(({ c, n }) => ({ value: `cat:${c.id}`, label: `${c.name} (${n})`, group: "Categories" })),
  ...(appStore.uncategorizedCount ? [{ value: "uncategorized", label: `Uncategorized (${appStore.uncategorizedCount})` }] : []),
  ...appStore.tags
    .filter((t) => t.usage_count)
    .map((t) => ({ value: `tag:${t.id}`, label: `#${t.name} (${t.usage_count})`, group: "Tags" })),
]);
const chosen = computed(() => source.value || sources.value[0]?.value || "");
function pickSource(event) {
  source.value = event.target.value;
}

const selection = computed(() => {
  const value = chosen.value;
  const all = appStore.allLinks;
  if (value === "favorites") return { heading: "Favorites", links: favoriteLinks(all, appStore.hiddenIds) };
  if (value === "uncategorized") return { heading: "Links", links: all.filter((l) => l.category_id == null) };
  const [kind, id] = value.split(":");
  if (kind === "cat") {
    const category = [...appStore.categories, ...appStore.sharedCategories].find((c) => String(c.id) === id);
    return { heading: category?.name || "", links: all.filter((l) => String(l.category_id) === id) };
  }
  if (kind === "tag") {
    const tag = appStore.tags.find((t) => String(t.id) === id);
    return { heading: tag ? `#${tag.name}` : "", links: all.filter((l) => (l.tags || []).some((t) => String(t.id) === id)) };
  }
  return { heading: "", links: [] };
});

const text = computed(() =>
  formatList(sortLinks(selection.value.links, appStore.sort), format.value, {
    heading: withHeading.value && format.value !== "csv" ? selection.value.heading : "",
    descriptions: descriptions.value,
  }),
);
const formatInfo = computed(() => LIST_FORMATS.find((f) => f.value === format.value));

async function copy() {
  try {
    // HTML goes on the clipboard as rich text too, so it pastes as links in an email
    if (format.value === "html" && window.ClipboardItem && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([text.value], { type: "text/html" }),
          "text/plain": new Blob([text.value], { type: "text/plain" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text.value);
    }
    toast.success(`Copied ${selection.value.links.length} link${selection.value.links.length === 1 ? "" : "s"}`);
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
}
function save() {
  const base = (selection.value.heading || "links").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "links";
  downloadText(text.value, `${base}.${formatInfo.value.ext}`, formatInfo.value.type);
}
</script>

<template>
  <div class="space-y-4" data-testid="share-list-tool">
    <p v-if="!sources.length" class="text-sm text-gray-600 dark:text-brand-300">
      Add some links to your shelf first.
    </p>
    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <label class="block text-sm font-medium" for="share-list-source">Which links</label>
          <select id="share-list-source" :value="chosen" :class="INPUT" data-testid="share-list-source" @change="pickSource">
            <option v-for="s in sources.filter((x) => !x.group)" :key="s.value" :value="s.value">{{ s.label }}</option>
            <optgroup v-if="sources.some((x) => x.group === 'Categories')" label="Categories">
              <option v-for="s in sources.filter((x) => x.group === 'Categories')" :key="s.value" :value="s.value">{{ s.label }}</option>
            </optgroup>
            <optgroup v-if="sources.some((x) => x.group === 'Tags')" label="Tags">
              <option v-for="s in sources.filter((x) => x.group === 'Tags')" :key="s.value" :value="s.value">{{ s.label }}</option>
            </optgroup>
          </select>
        </div>
        <fieldset class="space-y-1">
          <legend class="block text-sm font-medium">Format</legend>
          <div class="flex flex-wrap gap-1.5" role="radiogroup">
            <label
              v-for="f in LIST_FORMATS"
              :key="f.value"
              class="px-2.5 py-1 rounded-md border text-sm cursor-pointer"
              :class="
                format === f.value
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-800/60'
                  : 'border-gray-300 dark:border-brand-700 hover:border-brand-400'
              "
              :title="f.hint"
            >
              <input v-model="format" type="radio" class="sr-only" :value="f.value" :data-testid="`share-list-format-${f.value}`" />
              {{ f.label }}
            </label>
          </div>
          <p class="text-xs text-gray-500 dark:text-brand-400">{{ formatInfo.hint }}</p>
        </fieldset>
      </div>
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <label v-if="format !== 'csv'" class="flex items-center gap-2">
          <input v-model="withHeading" type="checkbox" /> Heading
        </label>
        <label v-if="format !== 'csv'" class="flex items-center gap-2">
          <input v-model="descriptions" type="checkbox" data-testid="share-list-descriptions" /> Descriptions
        </label>
      </div>
      <textarea
        :value="text"
        readonly
        rows="9"
        :class="INPUT"
        class="font-mono text-xs sm:text-sm"
        aria-label="The list"
        data-testid="share-list-output"
      ></textarea>
      <div class="flex flex-wrap gap-2">
        <button type="button" :class="PRIMARY" title="Copy the list" data-testid="share-list-copy" @click="copy">
          <i class="mdi mdi-content-copy" aria-hidden="true"></i> Copy {{ selection.links.length }} link{{ selection.links.length === 1 ? "" : "s" }}
        </button>
        <button type="button" :class="OUTLINE" :title="`Save the list as a .${formatInfo.ext} file`" @click="save">
          <i class="mdi mdi-download" aria-hidden="true"></i> Save as .{{ formatInfo.ext }}
        </button>
      </div>
    </template>
  </div>
</template>
