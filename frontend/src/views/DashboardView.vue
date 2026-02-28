<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import { useTheme } from "@/composables/useTheme";

const appStore = useAppStore();
const router = useRouter();
const { isDark, toggleTheme } = useTheme();

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
        <h2 class="font-semibold">
          <i class="mdi mdi-eye-outline mr-1"></i>View links
        </h2>
        <p class="text-sm text-gray-600 dark:text-brand-300">
          Browse categories and shared collections
        </p>
      </button>
      <button
        class="p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        @click="router.push({ name: 'edit' })"
      >
        <h2 class="font-semibold">
          <i class="mdi mdi-pencil-outline mr-1"></i>Edit links
        </h2>
        <p class="text-sm text-gray-600 dark:text-brand-300">
          Manage links, tags and categories
        </p>
      </button>
      <button
        class="p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        @click="router.push({ name: 'profile' })"
      >
        <h2 class="font-semibold">
          <i class="mdi mdi-account-outline mr-1"></i>Profile
        </h2>
        <p class="text-sm text-gray-600 dark:text-brand-300">
          Settings and account actions
        </p>
      </button>
      <button
        class="p-4 rounded-lg bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-800 text-left hover:border-brand-500"
        @click="router.push({ name: 'profile' })"
      >
        <h2 class="font-semibold">
          <i class="mdi mdi-swap-horizontal mr-1"></i>Import Data
        </h2>
        <p class="text-sm text-gray-600 dark:text-brand-300">
          Import or export your links and categories
        </p>
      </button>
    </div>

    <!-- Theme Toggle -->
    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
    >
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold text-gray-900 dark:text-white">Theme</h2>
          <p class="text-sm text-gray-600 dark:text-brand-300">
            {{ isDark ? "Dark mode" : "Light mode" }}
          </p>
        </div>
        <button
          class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-brand-800 transition-colors"
          @click="toggleTheme()"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <i
            class="mdi text-xl"
            :class="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          ></i>
        </button>
      </div>
    </article>
  </section>
</template>
