import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useToastStore } from "@/stores/toast";

describe("toast store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it("pushes a success toast with correct properties", () => {
    const store = useToastStore();
    store.success("Saved!");

    expect(store.items).toHaveLength(1);
    expect(store.items[0].type).toBe("success");
    expect(store.items[0].message).toBe("Saved!");
    expect(store.items[0].duration).toBe(3500);
    expect(store.items[0].createdAt).toBeTypeOf("number");
  });

  it("pushes an error toast", () => {
    const store = useToastStore();
    store.error("Oops");

    expect(store.items).toHaveLength(1);
    expect(store.items[0].type).toBe("error");
    expect(store.items[0].message).toBe("Oops");
  });

  it("pushes an info toast", () => {
    const store = useToastStore();
    store.info("FYI");

    expect(store.items).toHaveLength(1);
    expect(store.items[0].type).toBe("info");
  });

  it("auto-removes toast after duration", () => {
    const store = useToastStore();
    store.success("Temporary");

    expect(store.items).toHaveLength(1);
    vi.advanceTimersByTime(3500);
    expect(store.items).toHaveLength(0);
  });

  it("manually removes a toast by id", () => {
    const store = useToastStore();
    store.success("First");
    store.error("Second");

    const firstId = store.items[0].id;
    store.remove(firstId);

    expect(store.items).toHaveLength(1);
    expect(store.items[0].message).toBe("Second");
  });

  it("supports multiple toasts at once", () => {
    const store = useToastStore();
    store.success("One");
    store.error("Two");
    store.info("Three");

    expect(store.items).toHaveLength(3);
  });

  it("assigns unique ids to each toast", () => {
    const store = useToastStore();
    store.success("A");
    store.success("B");

    expect(store.items[0].id).not.toBe(store.items[1].id);
  });
});
