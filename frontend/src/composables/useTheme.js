import { computed } from "vue";
import { useDark, useToggle } from "@vueuse/core";

export function useTheme() {
  const isDark = useDark({ storageKey: "hiddenshelf_theme" });
  const toggle = useToggle(isDark);

  const mode = computed(() => (isDark.value ? "dark" : "light"));

  return {
    isDark,
    mode,
    toggleTheme: () => toggle(),
  };
}
