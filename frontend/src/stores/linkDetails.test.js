import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useLinkDetailsStore } from "@/stores/linkDetails";
import { useLinkPreviewStore } from "@/stores/linkPreview";

const links = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe("link details store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("walks through the links it was opened with", () => {
    const details = useLinkDetailsStore();
    details.open(links, links[1]);
    expect(details.current.id).toBe(2);
    expect([details.hasPrev, details.hasNext]).toEqual([true, true]);
    details.next();
    expect(details.current.id).toBe(3);
    details.next();
    expect(details.current.id).toBe(3);
    details.prev();
    details.prev();
    details.prev();
    expect(details.current.id).toBe(1);
    details.close();
    expect(details.current).toBeNull();
  });

  it("shows a link that isn't in the list on its own", () => {
    const details = useLinkDetailsStore();
    details.open(links, { id: 9 });
    expect(details.current.id).toBe(9);
    expect(details.links).toHaveLength(1);
  });
});

describe("link preview store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  const element = { getBoundingClientRect: () => ({ top: 10, bottom: 30, left: 0 }) };

  it("shows a description after a short hover and hides after leaving", () => {
    const preview = useLinkPreviewStore();
    preview.hoverStart({ id: 1, description: "Notes" }, element);
    vi.advanceTimersByTime(300);
    expect(preview.link).toBeNull();
    vi.advanceTimersByTime(200);
    expect(preview.link.id).toBe(1);
    preview.hoverEnd();
    preview.keep(); // pointer moved onto the card
    vi.advanceTimersByTime(300);
    expect(preview.link.id).toBe(1);
    preview.hoverEnd();
    vi.advanceTimersByTime(200);
    expect(preview.link).toBeNull();
    vi.useRealTimers();
  });

  it("does nothing for links without a description", () => {
    const preview = useLinkPreviewStore();
    preview.hoverStart({ id: 1, description: "" }, element);
    vi.advanceTimersByTime(1000);
    expect(preview.link).toBeNull();
    vi.useRealTimers();
  });
});
