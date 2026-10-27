import { describe, expect, it, vi } from "vitest";
import { backdropClose } from "@/lib/backdropClose";

const backdrop = {};
const inside = {};
const on = (target) => ({ target, currentTarget: backdrop });

describe("backdropClose", () => {
  it("closes on a click on the backdrop", () => {
    const close = vi.fn();
    const handlers = backdropClose(close);
    handlers.mousedown(on(backdrop));
    handlers.click(on(backdrop));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("stays open when a selection starts inside and ends on the backdrop", () => {
    const close = vi.fn();
    const handlers = backdropClose(close);
    handlers.mousedown(on(inside));
    handlers.click(on(backdrop));
    expect(close).not.toHaveBeenCalled();
    // The next real backdrop click still closes
    handlers.mousedown(on(backdrop));
    handlers.click(on(backdrop));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("ignores clicks inside the dialog", () => {
    const close = vi.fn();
    const handlers = backdropClose(close);
    handlers.mousedown(on(inside));
    handlers.click(on(inside));
    expect(close).not.toHaveBeenCalled();
  });
});
