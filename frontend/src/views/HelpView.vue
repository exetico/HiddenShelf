<script setup>
import { RouterLink } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { FAQ, FEATURE_GROUPS } from "@/content/features";

// Everything Hidden Shelf does, and the questions people ask. Open to
// everyone: signed out it stands alone, signed in it's inside the app.
const authStore = useAuthStore();
</script>

<template>
  <div
    :class="
      authStore.isAuthenticated
        ? ''
        : 'min-h-screen bg-brand-50 dark:bg-brand-950 px-4 py-8 sm:py-12'
    "
  >
    <section class="max-w-4xl mx-auto space-y-8" data-testid="help-page">
      <header class="space-y-2">
        <RouterLink
          v-if="!authStore.isAuthenticated"
          to="/login"
          title="Back to the sign-in page"
          class="inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-300 hover:underline"
          data-testid="help-sign-in"
        >
          <i class="mdi mdi-arrow-left" aria-hidden="true"></i> Sign in
        </RouterLink>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Features and FAQ
        </h1>
        <p class="text-gray-600 dark:text-brand-300">
          Hidden Shelf is a private, self-hosted place for your links. Here's
          what it can do.
        </p>
      </header>

      <section
        v-for="group in FEATURE_GROUPS"
        :key="group.title"
        :aria-label="group.title"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {{ group.title }}
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <article
            v-for="feature in group.features"
            :key="feature.title"
            class="flex gap-3 bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-4"
            data-testid="help-feature"
          >
            <i
              class="mdi text-2xl leading-none text-brand-500 dark:text-brand-400"
              :class="feature.icon"
              aria-hidden="true"
            ></i>
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white">{{ feature.title }}</h3>
              <p class="mt-1 text-sm text-gray-600 dark:text-brand-300">{{ feature.text }}</p>
            </div>
          </article>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading" class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Frequently asked questions
        </h2>
        <div
          class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 divide-y divide-gray-200 dark:divide-brand-800"
        >
          <details
            v-for="item in FAQ"
            :key="item.q"
            class="group p-4"
            data-testid="help-faq"
          >
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-gray-900 dark:text-white"
            >
              {{ item.q }}
              <i
                class="mdi mdi-chevron-down text-xl leading-none text-gray-500 transition-transform group-open:rotate-180"
                aria-hidden="true"
              ></i>
            </summary>
            <p class="mt-2 text-sm text-gray-600 dark:text-brand-300">{{ item.a }}</p>
          </details>
        </div>
      </section>
    </section>
  </div>
</template>
