import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import PublicLinkPage from "./PublicLinkPage.vue";

function respond(payload, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(payload),
  });
}

describe("PublicLinkPage", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/h/abc123");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the link and logs a visit", async () => {
    const fetchMock = vi.fn((url) =>
      url.startsWith("/api/links")
        ? respond({
            success: true,
            link: {
              title: "Example",
              description: "A page",
              url: "https://example.com",
              tags: [{ id: 1, name: "news" }],
              created_at: "2026-01-02 10:00:00",
            },
          })
        : respond({ success: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(PublicLinkPage);
    await flushPromises();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/links?hash=abc123");
    expect(wrapper.find("h1").text()).toBe("Example");
    expect(wrapper.text()).toContain("A page");
    expect(wrapper.text()).toContain("news");
    expect(wrapper.find('a[href="https://example.com"]').exists()).toBe(true);
    expect(document.title).toBe("Example — Hidden Shelf");

    const visit = fetchMock.mock.calls.find(([url]) => url === "/api/link_visits");
    expect(JSON.parse(visit[1].body)).toEqual({ hash: "abc123" });
  });

  it("reads ?hash= when opened as link.html on the dev server", async () => {
    window.history.replaceState({}, "", "/link.html?hash=dev42");
    const fetchMock = vi.fn(() => respond({ success: false, error: "x" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    mount(PublicLinkPage);
    await flushPromises();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/links?hash=dev42");
  });

  it("shows the error for a private or missing link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        respond({ success: false, error: "Link not found or is private" }, 404),
      ),
    );

    const wrapper = mount(PublicLinkPage);
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain(
      "Link not found or is private",
    );
  });

  it("shows an error without a hash", async () => {
    window.history.replaceState({}, "", "/link.html");
    vi.stubGlobal("fetch", vi.fn());

    const wrapper = mount(PublicLinkPage);
    await flushPromises();

    expect(wrapper.text()).toContain("No link given");
    expect(fetch).not.toHaveBeenCalled();
  });
});
