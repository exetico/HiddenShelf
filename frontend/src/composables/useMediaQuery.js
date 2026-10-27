import { onMounted, onUnmounted, ref } from "vue";

/** A ref that follows a CSS media query, e.g. "(min-width: 1280px)". */
export function useMediaQuery(query) {
  const list = typeof window !== "undefined" ? window.matchMedia?.(query) : null;
  const matches = ref(Boolean(list?.matches));
  const update = (event) => {
    matches.value = event.matches;
  };
  onMounted(() => list?.addEventListener?.("change", update));
  onUnmounted(() => list?.removeEventListener?.("change", update));
  return matches;
}
