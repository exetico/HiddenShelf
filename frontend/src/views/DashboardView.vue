<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
const router = useRouter();

const totalLinks = computed(() => appStore.total || appStore.links.length);
</script>

<template>
  <section class="space-y-6">
    <header>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        Welcome back
      </h1>
      <p class="text-gray-600 dark:text-brand-300">Overview of your shelf</p>
    </header>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <article
        class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
      >
        <p class="text-sm text-gray-600 dark:text-brand-300">Links</p>
        <p class="text-3xl font-bold">{{ totalLinks }}</p>
      </article>
      <article
        class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
      >
        <p class="text-sm text-gray-600 dark:text-brand-300">Categories</p>
        <p class="text-3xl font-bold">{{ appStore.totalCategories }}</p>
      </article>
      <article
        class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
      >
        <p class="text-sm text-gray-600 dark:text-brand-300">Tags</p>
        <p class="text-3xl font-bold">{{ appStore.totalTags }}</p>
      </article>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        class="p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        @click="router.push({ name: 'view' })"
      >
        <h2 class="font-semibold">View links</h2>
        <p class="text-sm text-gray-600 dark:text-brand-300">
          Browse categories and shared collections
        </p>
      </button>
      <button
        class="p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        @click="router.push({ name: 'edit' })"
      >
        <h2 class="font-semibold">Edit links</h2>
        <p class="text-sm text-gray-600 dark:text-brand-300">
          Manage links, tags and categories
        </p>
      </button>
      <button
        class="p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        @click="router.push({ name: 'profile' })"
      >
        <h2 class="font-semibold">Profile</h2>
        <p class="text-sm text-gray-600 dark:text-brand-300">
          Settings and account actions
        </p>
      </button>
    </div>
  </section>
</template>
