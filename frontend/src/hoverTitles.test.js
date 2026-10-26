import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Every button and link should say what it does on hover (title), which
// also helps screen readers and icon-only buttons. This guards new ones.
function vueFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.name.endsWith(".vue") ? [path] : [];
  });
}

describe("hover titles", () => {
  it("every <button>, <a> and <router-link> has a title", () => {
    const missing = [];
    for (const file of vueFiles(import.meta.dirname)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<(button|a|router-link)\b([^>]*)>/g)) {
        if (!/(^|\s):?title=/.test(match[2])) {
          const line = source.slice(0, match.index).split("\n").length;
          missing.push(`${relative(import.meta.dirname, file)}:${line}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
