<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
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
  set: async (value) => {
    const was = appStore.search;
    appStore.search = value;
    if (value && route.name !== "view" && route.name !== "edit") {
      await router.push({ name: "view" });
    }
    // The first letter brings the results up to the top of the screen, past
    // the filters above them; clearing goes back to the top of the page
    if (value && !was) await showResults();
    else if (!value && was) scrollToTop();
  },
});

// Results first: the count line ("Showing 5 of 65 links") lands just under
// the top of the screen, with the matches right after it. Short results
// would leave too little page to scroll that far, so the page gets just
// enough room below them for as long as the search is on.
const RESULTS = '[data-testid="link-count"]';
function scrollBehavior() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
function main() {
  return document.querySelector('[data-testid="app-main"]');
}
async function showResults() {
  await nextTick();
  const row = document.querySelector(RESULTS)?.parentElement;
  if (!row) return;
  const top = Math.max(0, row.getBoundingClientRect().top + window.scrollY - 8);
  const shell = main();
  if (shell) {
    const needed = top + window.innerHeight - (shell.getBoundingClientRect().top + window.scrollY);
    shell.style.minHeight = `${Math.ceil(needed)}px`;
  }
  holdY = null; // this scroll is ours, not the browser's
  window.scrollTo({ top, behavior: scrollBehavior() });
}
function releaseRoom() {
  const shell = main();
  if (shell) shell.style.minHeight = "";
}
// The extra room goes as soon as the search is cleared, from anywhere
watch(
  () => appStore.search,
  (value) => {
    if (!value) releaseRoom();
  },
);
watch(() => route.name, releaseRoom);

function scrollToTop() {
  releaseRoom();
  holdY = null;
  window.scrollTo({ top: 0, behavior: scrollBehavior() });
}

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

// The page stays where it is when the box gets focus. iPhone Safari
// otherwise scrolls the page to bring the box into view (it doesn't know
// the bar will be lifted above the keyboard), so the links behind it jump.
// A tap focuses the box ourselves without scrolling, and any scroll the
// browser still makes while the keyboard opens is undone.
const panel = ref(null);
const inputEl = () => panel.value?.querySelector("input");
const SETTLE_MS = 800;
let holdY = null;
let holdTimer = 0;

function onPointerDown(event) {
  const input = inputEl();
  if (!input || event.target !== input || document.activeElement === input) return;
  event.preventDefault();
  input.focus({ preventScroll: true });
}
function holdScroll() {
  if (holdY !== null && Math.abs(window.scrollY - holdY) > 1) window.scrollTo(0, holdY);
}

function onFocusIn() {
  focused.value = true;
  revealed.value = true;
  armed.value = true;
  holdY = window.scrollY;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => (holdY = null), SETTLE_MS);
  updateKeyboard();
}
function onFocusOut() {
  focused.value = false;
  holdY = null;
}

// Done (or the keyboard's search key) closes the keyboard. It keeps the
// focus until it is tapped, so the button doesn't vanish under the finger.
function close() {
  inputEl()?.blur();
}

// Above the keyboard: how much of the screen's bottom the keyboard covers
const keyboard = ref(0);
function updateKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  keyboard.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}
const lift = computed(() =>
  focused.value && keyboard.value > 0 ? { bottom: `${keyboard.value + 8}px` } : null,
);

onMounted(() => {
  lastY = window.scrollY;
  atTop.value = lastY <= TOP;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("scroll", holdScroll, { passive: true });
  window.visualViewport?.addEventListener("resize", updateKeyboard);
  window.visualViewport?.addEventListener("scroll", updateKeyboard);
});
onUnmounted(() => {
  releaseRoom();
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("scroll", holdScroll);
  window.visualViewport?.removeEventListener("resize", updateKeyboard);
  window.visualViewport?.removeEventListener("scroll", updateKeyboard);
  clearTimeout(holdTimer);
  if (frame) cancelAnimationFrame(frame);
  clearTimeout(armTimer);
});
</script>

<template>
  <!-- Kept off the screen edges rather than padded away from them: Safari
       on iPhone tints its toolbar from a fixed layer that touches the
       bottom edge, which showed as a black strip under the bar -->
  <div
    class="md:hidden fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-20 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
    :class="[
      visible ? 'translate-y-0 opacity-100' : 'translate-y-[calc(100%+2rem)] opacity-0',
      visible && armed ? 'pointer-events-auto' : 'pointer-events-none',
    ]"
    data-testid="floating-search"
    :data-hidden="visible ? null : 'true'"
    :aria-hidden="visible ? null : 'true'"
    :style="lift"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <!-- One rounded, see-through bar: the search box itself, no box in a box -->
    <div
      ref="panel"
      class="flex items-center rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/75 dark:bg-brand-900/70 backdrop-blur-2xl backdrop-saturate-150 shadow-lg shadow-black/10 dark:shadow-black/40 focus-within:border-brand-500 dark:focus-within:border-brand-400"
      data-testid="floating-search-panel"
    >
      <SearchField
        v-model="searchText"
        placeholder="Search links..."
        class="h-12 border-0! bg-transparent! dark:bg-transparent! rounded-2xl! focus:outline-none"
        title="Search titles, descriptions, URLs and tags"
        enterkeyhint="search"
        data-testid="floating-search-input"
        @pointerdown="onPointerDown"
        @keydown.enter.prevent="close"
      />
      <!-- Only while typing: closes the keyboard (so does the keyboard's
           search key). Small, beside the clear icon. Holding on to the
           focus until the tap ends keeps it from moving away under the finger -->
      <button
        v-if="focused"
        type="button"
        class="shrink-0 w-11 h-12 -ml-1 mr-0.5 flex items-center justify-center text-gray-500 dark:text-brand-300 active:text-brand-700 dark:active:text-white"
        title="Close the keyboard"
        aria-label="Close the keyboard"
        data-testid="floating-search-done"
        @pointerdown.prevent
        @mousedown.prevent
        @click="close"
      >
        <i class="mdi mdi-keyboard-close-outline text-xl leading-none" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>
