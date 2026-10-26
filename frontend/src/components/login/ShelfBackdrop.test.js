import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import ShelfBackdrop from "@/components/login/ShelfBackdrop.vue";

describe("ShelfBackdrop", () => {
  it("is decoration only", () => {
    const root = mount(ShelfBackdrop).find('[data-testid="shelf-backdrop"]');
    expect(root.attributes("aria-hidden")).toBe("true");
  });

  it("draws the same shelf of books every time", () => {
    const sizes = () =>
      mount(ShelfBackdrop)
        .findAll(".book")
        .map((b) => b.attributes("style"));
    const first = sizes();
    expect(first.length).toBe(64);
    expect(sizes()).toEqual(first);
  });

  it("keeps its dark-mode tweaks scoped to the art", () => {
    // :global(html.dark) .x compiles to a bare `html.dark` rule, which
    // once faded every page in dark mode
    const source = readFileSync(
      resolve(import.meta.dirname, "ShelfBackdrop.vue"),
      "utf8",
    );
    expect(source).not.toContain(":global(");
  });

  it("animates light, dust and a few books, unless motion is reduced", () => {
    const wrapper = mount(ShelfBackdrop);
    expect(wrapper.findAll(".mote").length).toBe(18);
    expect(wrapper.findAll(".book.pull").length).toBeGreaterThan(3);
    const source = readFileSync(
      resolve(import.meta.dirname, "ShelfBackdrop.vue"),
      "utf8",
    );
    expect(source).toMatch(/@keyframes pull/);
    expect(source).toMatch(/@keyframes float/);
    expect(source).toMatch(/prefers-reduced-motion: reduce/);
  });
});
