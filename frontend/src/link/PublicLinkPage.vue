<script setup>
import { ref, onMounted } from "vue";
import { request } from "@/lib/httpClient";

const link = ref(null);
const loading = ref(true);
const error = ref("");

/** /h/:hash in production; ?hash= when opening link.html on the dev server */
function hashFromLocation() {
  const fromPath = window.location.pathname.match(/\/h\/([a-zA-Z0-9]+)/);
  if (fromPath) return fromPath[1];
  return new URLSearchParams(window.location.search).get("hash");
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

onMounted(async () => {
  const hash = hashFromLocation();
  if (!hash) {
    error.value = "No link given";
    loading.value = false;
    return;
  }

  try {
    const response = await request(`/api/links?hash=${encodeURIComponent(hash)}`);
    link.value = response.link;
    document.title = `${response.link.title} — Hidden Shelf`;
    // Visit logging is best effort
    request("/api/link_visits", {
      method: "POST",
      body: JSON.stringify({ hash }),
    }).catch(() => {});
  } catch (err) {
    error.value = err.message || "Failed to load link";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-12">
    <p v-if="loading" class="text-center text-gray-500 dark:text-brand-300">
      Loading...
    </p>

    <div
      v-else-if="error"
      class="rounded-lg bg-red-50 p-6 text-red-700 dark:bg-red-950 dark:text-red-300"
      role="alert"
    >
      <h1 class="mb-2 text-xl font-bold">Link unavailable</h1>
      <p>{{ error }}</p>
    </div>

    <article
      v-else
      class="rounded-lg bg-white p-8 shadow-md dark:bg-brand-900 dark:shadow-none"
    >
      <header class="mb-4 flex items-start justify-between gap-4">
        <h1 class="text-3xl font-bold break-words">{{ link.title }}</h1>
        <span
          class="shrink-0 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 dark:bg-green-900 dark:text-green-200"
        >
          Public link
        </span>
      </header>

      <p v-if="link.description" class="mb-6 text-gray-600 dark:text-brand-200">
        {{ link.description }}
      </p>

      <a
        :title="`Open ${link.url}`"
        :href="link.url"
        rel="noopener noreferrer"
        class="mb-6 block text-lg break-all text-blue-600 hover:underline dark:text-blue-400"
      >
        {{ link.url }}
      </a>

      <ul v-if="link.tags?.length" class="mb-6 flex flex-wrap gap-2">
        <li
          v-for="tag in link.tags"
          :key="tag.id"
          class="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-brand-800 dark:text-brand-100"
        >
          {{ tag.name }}
        </li>
      </ul>

      <div class="border-t border-gray-200 pt-6 dark:border-brand-700">
        <a
          :title="`Open ${link.url}`"
          :href="link.url"
          rel="noopener noreferrer"
          class="inline-block rounded-md bg-brand-600 px-6 py-3 text-white transition hover:bg-brand-700"
        >
          Visit link →
        </a>
      </div>

      <footer
        class="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-500 dark:border-brand-700 dark:text-brand-300"
      >
        Shared via Hidden Shelf · {{ formatDate(link.created_at) }}
      </footer>
    </article>
  </main>
</template>
