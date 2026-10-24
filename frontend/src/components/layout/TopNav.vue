<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/composables/useTheme";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { mode, toggleTheme } = useTheme();

const activeRoute = computed(() => route.name);

function goTo(name) {
  router.push({ name });
}
</script>

<template>
  <header
    class="bg-white dark:bg-brand-900 border-b border-gray-200 dark:border-brand-800 transition-colors"
  >
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4"
    >
      <button
        class="text-xl font-bold text-gray-900 dark:text-white"
        @click="goTo('dashboard')"
      >
        Hidden Shelf
      </button>

      <div class="flex items-center gap-2 sm:gap-3">
        <div class="bg-gray-100 dark:bg-brand-800 rounded-lg p-1 flex gap-1">
          <button
            class="px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5"
            :class="
              activeRoute === 'view'
                ? 'bg-brand-600 text-white'
                : 'text-gray-700 dark:text-brand-200 hover:bg-gray-200 dark:hover:bg-brand-700'
            "
            @click="goTo('view')"
          >
            <i class="mdi mdi-view-list"></i>
            View
          </button>
          <button
            class="px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5"
            :class="
              activeRoute === 'edit'
                ? 'bg-brand-600 text-white'
                : 'text-gray-700 dark:text-brand-200 hover:bg-gray-200 dark:hover:bg-brand-700'
            "
            @click="goTo('edit')"
          >
            <i class="mdi mdi-pencil"></i>
            Edit
          </button>
        </div>

        <button
          class="w-9 h-9 rounded-full bg-brand-600 text-white text-sm font-semibold"
          :title="authStore.user?.email"
          @click="goTo('profile')"
        >
          {{ authStore.initials }}
        </button>

        <button
          class="p-2 rounded-md text-gray-700 dark:text-brand-200 hover:bg-gray-100 dark:hover:bg-brand-800"
          @click="toggleTheme"
        >
          <i
            :class="
              mode === 'dark'
                ? 'mdi mdi-weather-sunny'
                : 'mdi mdi-weather-night'
            "
            class="text-lg"
          ></i>
        </button>
      </div>
    </div>
  </header>
</template>
