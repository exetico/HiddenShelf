<script setup>
/**
 * Admin page, for admins listed in UPDATE_ADMIN_EMAILS (the server answers
 * 404 to anyone else, and the router sends them to the dashboard).
 * Things that are about the whole server, not one account, go here.
 */
import ServerUpdates from "@/components/admin/ServerUpdates.vue";
</script>

<template>
  <section class="max-w-3xl space-y-6" data-testid="admin-page">
    <div>
      <h1 class="text-xl font-semibold">Admin</h1>
      <p class="text-sm text-gray-500 dark:text-brand-400">
        Settings for the whole server. Only admins see this page.
      </p>
    </div>
    <ServerUpdates />
  </section>
</template>
