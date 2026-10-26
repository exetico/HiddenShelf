import { reactive } from "vue";

/**
 * Drag-and-drop reordering of links inside one category.
 *
 * Safe by design: a drag only starts from the grip handle (it "arms" the
 * card on mousedown), and a drop only lands within the same category.
 * Dragging a link from anywhere else still drags its URL as browsers do.
 */
export const DRAG_TYPE = "application/x-hiddenshelf-link";

const state = reactive({
  armedId: null,
  draggingId: null,
  groupKey: null,
  overId: null,
  overPosition: null, // "before" | "after"
});

export function useLinkDrag() {
  function arm(link) {
    state.armedId = link.id;
  }

  function disarm() {
    state.armedId = null;
  }

  /** Returns true when this dragstart is a reorder (else a normal URL drag) */
  function start(event, link, groupKey) {
    if (state.armedId !== link.id) return false;
    state.draggingId = link.id;
    state.groupKey = groupKey;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, String(link.id));
    return true;
  }

  function canDropOn(link, groupKey) {
    return (
      state.draggingId !== null &&
      state.groupKey === groupKey &&
      state.draggingId !== link.id
    );
  }

  function over(event, link, groupKey) {
    if (!canDropOn(link, groupKey)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    state.overId = link.id;
    state.overPosition =
      event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  function leave(link) {
    if (state.overId === link.id) state.overId = null;
  }

  /** Returns { draggedId, targetId, position } for a valid drop, else null */
  function drop(event, link, groupKey) {
    if (!canDropOn(link, groupKey)) return null;
    event.preventDefault();
    const result = {
      draggedId: state.draggingId,
      targetId: link.id,
      position: state.overPosition || "before",
    };
    end();
    return result;
  }

  function end() {
    state.armedId = null;
    state.draggingId = null;
    state.groupKey = null;
    state.overId = null;
    state.overPosition = null;
  }

  return { state, arm, disarm, start, over, leave, drop, end };
}

/** The new order of `ids` after moving draggedId before/after targetId */
export function reorderIds(ids, { draggedId, targetId, position }) {
  const without = ids.filter((id) => id !== draggedId);
  const at = without.indexOf(targetId);
  if (at === -1 || !ids.includes(draggedId)) return ids;
  without.splice(position === "after" ? at + 1 : at, 0, draggedId);
  return without;
}
