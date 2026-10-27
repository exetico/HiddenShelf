import { onMounted, onUnmounted, ref } from "vue";

/**
 * Hides a sticky bar while you scroll down and brings it back as soon as
 * you scroll up. It stays put near the top of the page (`offset` px), for
 * small jitters (`tolerance` px), and while `keepVisible()` says so (e.g.
 * the search box has focus).
 */
export function useHideOnScroll({ offset = 80, tolerance = 6, keepVisible = () => false } = {}) {
  const hidden = ref(false);
  let lastY = 0;
  let frame = 0;

  function update() {
    frame = 0;
    const y = Math.max(0, window.scrollY);
    const delta = y - lastY;
    if (y <= offset || keepVisible()) hidden.value = false;
    else if (delta > tolerance) hidden.value = true;
    else if (delta < -tolerance) hidden.value = false;
    else return; // too small to count; keep measuring from the old spot
    lastY = y;
  }

  // One check per frame, however fast scroll events come
  function onScroll() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  // Tabbing into the bar should always show it
  function show() {
    hidden.value = false;
  }

  onMounted(() => {
    lastY = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
  });
  onUnmounted(() => {
    window.removeEventListener("scroll", onScroll);
    if (frame) cancelAnimationFrame(frame);
  });

  return { hidden, show };
}
