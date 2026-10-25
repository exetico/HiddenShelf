import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(import.meta.dirname, "styles.css"), "utf-8");

describe("global styles", () => {
  it("keeps form fields at 16px on phones so iOS Safari doesn't zoom in", () => {
    const rule = css.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n  \}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/select,\s*textarea\s*\{\s*font-size: 16px;/);
    expect(rule[1]).toContain('input:not([type="checkbox"])');
  });
});
