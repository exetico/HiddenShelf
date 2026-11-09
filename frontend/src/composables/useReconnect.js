import { onBeforeUnmount, onMounted } from "vue";
import { onReconnect } from "@/lib/connection";

/**
 * Runs fn when the server answers again after it couldn't be reached
 * (lib/connection.js), for as long as the component is on the page.
 * Use it to load again whatever failed while the server was away.
 */
export function useReconnect(fn) {
  let stop = null;
  onMounted(() => {
    stop = onReconnect(fn);
  });
  onBeforeUnmount(() => stop?.());
}
