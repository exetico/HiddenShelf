import { afterEach, describe, expect, it } from "vitest";
import { reorderIds, useLinkDrag, DRAG_TYPE } from "@/composables/useLinkDrag";

function dragEvent(clientY = 0, rect = { top: 0, height: 40 }) {
  const data = {};
  return {
    clientY,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    currentTarget: { getBoundingClientRect: () => rect },
    dataTransfer: {
      setData: (type, value) => (data[type] = value),
      data,
    },
  };
}

describe("reorderIds", () => {
  it("moves a link before or after another", () => {
    expect(reorderIds([1, 2, 3, 4], { draggedId: 4, targetId: 2, position: "before" })).toEqual([1, 4, 2, 3]);
    expect(reorderIds([1, 2, 3, 4], { draggedId: 1, targetId: 3, position: "after" })).toEqual([2, 3, 1, 4]);
  });

  it("leaves the list alone for unknown ids", () => {
    expect(reorderIds([1, 2], { draggedId: 9, targetId: 2, position: "before" })).toEqual([1, 2]);
  });
});

describe("useLinkDrag", () => {
  const drag = useLinkDrag();
  const a = { id: 1 };
  const b = { id: 2 };
  afterEach(() => drag.end());

  it("only starts a reorder from the grip (armed)", () => {
    expect(drag.start(dragEvent(), a, "work")).toBe(false);
    drag.arm(a);
    const event = dragEvent();
    expect(drag.start(event, a, "work")).toBe(true);
    expect(event.dataTransfer.data[DRAG_TYPE]).toBe("1");
  });

  it("drops before or after depending on the pointer's half", () => {
    drag.arm(a);
    drag.start(dragEvent(), a, "work");
    const overTop = dragEvent(5);
    drag.over(overTop, b, "work");
    expect(overTop.defaultPrevented).toBe(true);
    expect(drag.state.overPosition).toBe("before");
    drag.over(dragEvent(35), b, "work");
    expect(drag.drop(dragEvent(35), b, "work")).toEqual({
      draggedId: 1,
      targetId: 2,
      position: "after",
    });
    expect(drag.state.draggingId).toBeNull();
  });

  it("refuses drops in another category", () => {
    drag.arm(a);
    drag.start(dragEvent(), a, "work");
    const other = dragEvent(5);
    drag.over(other, b, "home");
    expect(other.defaultPrevented).toBe(false);
    expect(drag.drop(dragEvent(), b, "home")).toBeNull();
  });
});
