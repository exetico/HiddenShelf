import { describe, expect, it } from "vitest";
import { EMBED_HEIGHT, embedSnippet, embedUrl } from "@/lib/embed";

describe("embed", () => {
  it("points at the card, with an optional theme", () => {
    expect(embedUrl("https://shelf.example/h/abc")).toBe("https://shelf.example/h/abc/embed");
    expect(embedUrl("https://shelf.example/h/abc", "dark")).toBe("https://shelf.example/h/abc/embed?theme=dark");
  });

  it("builds an iframe with a safe title", () => {
    expect(embedSnippet("https://s.dk/h/abc", 'My "best" <link>', "light")).toBe(
      `<iframe src="https://s.dk/h/abc/embed?theme=light" title="My &quot;best&quot; &lt;link>" width="100%" height="${EMBED_HEIGHT}" style="border:0;max-width:480px" loading="lazy"></iframe>`,
    );
  });
});
