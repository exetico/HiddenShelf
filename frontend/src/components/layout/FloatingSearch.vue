<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";
import SearchField from "@/components/common/SearchField.vue";

// Phones only, and only when turned on in Settings: a search box at the
// bottom of the screen. Typing on a page without a list jumps to View with
// the results, like the search in the desktop top bar.
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const searchText = computed({
  get: () => appStore.search,
  set: (value) => {
    appStore.search = value;
    if (value && route.name !== "view" && route.name !== "edit") router.push({ name: "view" });
  },
});

// When it shows. It must never slide in under a finger that was going for
// a link, so it doesn't come back on its own in the middle of a page:
// - at the top of the page (where you land, so it's there on load)
// - while you're typing in it
// - after the top bar's magnifier focuses it, until you scroll down again
const TOP = 80;
const TOLERANCE = 6;
const atTop = ref(true);
const focused = ref(false);
const revealed = ref(false);
let lastY = 0;
let frame = 0;

function update() {
  frame = 0;
  const y = Math.max(0, window.scrollY);
  atTop.value = y <= TOP;
  if (y - lastY > TOLERANCE && !focused.value) revealed.value = false;
  if (Math.abs(y - lastY) > TOLERANCE) lastY = y;
}
function onScroll() {
  if (!frame) frame = requestAnimationFrame(update);
}

const visible = computed(() => atTop.value || focused.value || revealed.value);

// Taps only count once it has been in place for a moment, so a tap meant
// for what was under it as it slid in doesn't land in the search box
const ARM_MS = 400;
const armed = ref(false);
let armTimer = 0;
watch(
  visible,
  (now) => {
    clearTimeout(armTimer);
    armed.value = false;
    if (now) armTimer = setTimeout(() => (armed.value = true), ARM_MS);
  },
  { immediate: true },
);

function onFocusIn() {
  focused.value = true;
  revealed.value = true;
  armed.value = true;
}
function onFocusOut() {
  focused.value = false;
}

onMounted(() => {
  lastY = window.scrollY;
  atTop.value = lastY <= TOP;
  window.addEventListener("scroll", onScroll, { passive: true });
});
onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
  if (frame) cancelAnimationFrame(frame);
  clearTimeout(armTimer);
});
</script>

<template>
  <div
    class="md:hidden fixed inset-x-0 bottom-0 z-20 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
    :class="[
      visible ? 'translate-y-0 opacity-100' : 'translate-y-[calc(100%+1rem)] opacity-0',
      visible && armed ? 'pointer-events-auto' : 'pointer-events-none',
    ]"
    data-testid="floating-search"
    :data-hidden="visible ? null : 'true'"
    :aria-hidden="visible ? null : 'true'"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <!-- One rounded, see-through bar: the search box itself, no box in a box -->
    <div
      class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/75 dark:bg-brand-900/70 backdrop-blur-2xl backdrop-saturate-150 shadow-lg shadow-black/10 dark:shadow-black/40 focus-within:border-brand-500 dark:focus-within:border-brand-400"
      data-testid="floating-search-panel"
    >
      <SearchField
        v-model="searchText"
        placeholder="Search links..."
        class="h-12 border-0! bg-transparent! dark:bg-transparent! rounded-2xl! focus:outline-none"
        title="Search titles, descriptions, URLs and tags"
        data-testid="floating-search-input"
      />
    </div>
  </div>
</template>
