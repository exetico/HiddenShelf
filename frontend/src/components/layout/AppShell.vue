<script setup>
import TopNav from "@/components/layout/TopNav.vue";
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-brand-950 transition-colors">
    <TopNav />
    <main class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
      <slot />
    </main>
  </div>
</template>
