<script setup>
import { reactive } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";

const authStore = useAuthStore();
const appStore = useAppStore();

const form = reactive({
  links_per_page: appStore.settings.links_per_page,
  brand_color: appStore.settings.brand_color,
});

const shareCode = reactive({
  code: "",
});

async function saveSettings() {
  await appStore.updateSettings({
    links_per_page: Number(form.links_per_page),
    brand_color: form.brand_color,
  });
}

async function joinShare() {
  if (!shareCode.code.trim()) return;
  await appStore.acceptShare(shareCode.code.trim());
  shareCode.code = "";
}
</script>

<template>
  <section class="max-w-3xl space-y-6">
    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
    >
      <h1 class="text-2xl font-bold">Profile</h1>
      <p class="text-gray-600 dark:text-brand-300 mt-1">
        {{ authStore.user?.email }}
      </p>
    </article>

    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5 space-y-3"
    >
      <h2 class="text-lg font-semibold">Settings</h2>
      <label class="block text-sm">Links per page</label>
      <select
        v-model="form.links_per_page"
        class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      >
        <option :value="20">20</option>
        <option :value="50">50</option>
        <option :value="100">100</option>
        <option :value="250">250</option>
        <option :value="500">500</option>
      </select>

      <label class="block text-sm">Brand color</label>
      <input
        v-model="form.brand_color"
        type="color"
        class="h-10 w-full rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
      />

      <button
        class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        @click="saveSettings"
      >
        Save settings
      </button>
    </article>

    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5 space-y-3"
    >
      <h2 class="text-lg font-semibold">Shared categories</h2>
      <form class="flex gap-2" @submit.prevent="joinShare">
        <input
          v-model="shareCode.code"
          placeholder="Share code"
          class="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-brand-700 dark:bg-brand-800"
        />
        <button
          class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700"
        >
          Join
        </button>
      </form>

      <ul class="space-y-2">
        <li
          v-for="category in appStore.sharedCategories"
          :key="category.id"
          class="flex items-center justify-between border border-gray-200 dark:border-brand-800 rounded-md p-2"
        >
          <div>
            <p class="font-medium">{{ category.name }}</p>
            <p class="text-xs text-gray-500 dark:text-brand-400">
              Shared by {{ category.owner_email }}
            </p>
          </div>
          <button
            class="text-red-600 dark:text-red-400 text-sm"
            @click="appStore.leaveSharedCategory(category.id)"
          >
            Leave
          </button>
        </li>
      </ul>
    </article>

    <article
      class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5"
    >
      <button
        class="px-4 py-2 rounded-md border border-red-400 text-red-700 dark:text-red-300"
        @click="authStore.logout"
      >
        Logout
      </button>
    </article>
  </section>
</template>
