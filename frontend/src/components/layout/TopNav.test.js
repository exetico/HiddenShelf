import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useLinkEditorStore } from "@/stores/linkEditor";
import { useAppStore } from "@/stores/app";
import TopNav from "@/components/layout/TopNav.vue";

const mockPush = vi.fn();
const mockRoute = { name: "view" };
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/composables/useTheme", () => ({
  useTheme: () => ({ mode: "dark", toggleTheme: vi.fn() }),
}));

describe("TopNav", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    useAuthStore().user = { email: "t@example.com" };
    mockPush.mockClear();
    mockRoute.name = "view";
    localStorage.clear();
  });

  const mountNav = () => mount(TopNav, { global: { plugins: [pinia] } });

  it("is 48px tall on phones and 64px from sm up", () => {
    const bar = mountNav().find("header > div");
    expect(bar.classes()).toEqual(expect.arrayContaining(["h-12", "sm:h-16"]));
  });

  it("shows the bookshelf icon as the home button", async () => {
    const wrapper = mountNav();
    const home = wrapper.find('[aria-label="Hidden Shelf home"]');
    expect(home.find(".mdi-bookshelf").exists()).toBe(true);
    await home.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "dashboard" });
  });

  it("keeps View/Edit labels for screen readers on very narrow screens", () => {
    const labels = mountNav().findAll("span.max-\\[359px\\]\\:sr-only");
    expect(labels.map((l) => l.text())).toEqual(["View", "Edit"]);
  });

  describe("View/Edit switch", () => {
    const thumb = (w) => w.find('[data-testid="mode-thumb"]');
    const modeButtons = (w) =>
      w.findAll('[role="group"] button').map((b) => ({
        text: b.text(),
        current: b.attributes("aria-current"),
      }));

    it("marks the page you are on", () => {
      mockRoute.name = "edit";
      const wrapper = mountNav();
      expect(modeButtons(wrapper)).toEqual([
        { text: "View", current: undefined },
        { text: "Edit", current: "page" },
      ]);
      expect(thumb(wrapper).classes()).toEqual(
        expect.arrayContaining(["translate-x-full", "bg-brand-600"]),
      );
    });

    it("still shows the last mode, dimmed, on other pages", () => {
      mockRoute.name = "edit";
      mountNav().unmount(); // remembers "edit"
      mockRoute.name = "dashboard";
      const wrapper = mountNav();
      expect(thumb(wrapper).classes()).toContain("translate-x-full");
      expect(thumb(wrapper).classes()).not.toContain("bg-brand-600");
      expect(modeButtons(wrapper).every((b) => !b.current)).toBe(true);
    });

    it("defaults to View when nothing is remembered", () => {
      mockRoute.name = "profile";
      expect(thumb(mountNav()).classes()).toContain("translate-x-0");
    });

    it("switches mode on click", async () => {
      const wrapper = mountNav();
      await wrapper.findAll('[role="group"] button')[1].trigger("click");
      expect(mockPush).toHaveBeenCalledWith({ name: "edit" });
    });
  });

  it("has a hover title on every button", () => {
    const buttons = mountNav().findAll("button");
    expect(buttons.filter((b) => !b.attributes("title"))).toEqual([]);
  });

  it("flips to the other mode when you tap the one you're on", async () => {
    mockRoute.name = "edit";
    const wrapper = mountNav();
    const [view, edit] = wrapper.findAll('[role="group"] button');
    expect(edit.attributes("title")).toBe("Switch to View");
    await edit.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "view" });
    mockPush.mockClear();
    await view.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "view" });
  });

  it("opens the tools page from its button", async () => {
    const wrapper = mountNav();
    const button = wrapper.find('[data-testid="nav-tools-page"]');
    expect(button.attributes("aria-current")).toBeUndefined();
    await button.trigger("click");
    expect(mockPush).toHaveBeenCalledWith({ name: "tools" });
    mockRoute.name = "tools";
    expect(mountNav().find('[data-testid="nav-tools-page"]').attributes("aria-current")).toBe("page");
  });

  describe("account menu", () => {
    const openMenu = async (wrapper) => {
      await wrapper.find('[data-testid="profile-button"]').trigger("click");
      return wrapper;
    };
    const items = (w) => w.findAll('[role="menuitem"]').map((b) => b.text());

    it("has no Admin button in the bar itself", () => {
      useAuthStore().canUpdate = true;
      expect(mountNav().find('[data-testid="nav-admin"]').exists()).toBe(false);
    });

    it("opens from the initials button with Settings and Log out", async () => {
      const wrapper = mountNav();
      const button = wrapper.find('[data-testid="profile-button"]');
      expect(button.attributes("aria-haspopup")).toBe("menu");
      expect(button.attributes("aria-expanded")).toBe("false");
      expect(wrapper.find('[role="menu"]').exists()).toBe(false);
      await openMenu(wrapper);
      expect(button.attributes("aria-expanded")).toBe("true");
      expect(items(wrapper)).toEqual(["Settings", "Log out"]);
      expect(wrapper.find('[role="menu"]').text()).toContain("t@example.com");
    });

    it("adds Admin for admins only", async () => {
      useAuthStore().canUpdate = true;
      const wrapper = await openMenu(mountNav());
      expect(items(wrapper)).toEqual(["Settings", "Admin", "Log out"]);
      await wrapper.find('[data-testid="menu-admin"]').trigger("click");
      expect(mockPush).toHaveBeenCalledWith({ name: "admin" });
      expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    });

    it("goes to the settings page from Settings", async () => {
      const wrapper = await openMenu(mountNav());
      await wrapper.find('[data-testid="menu-settings"]').trigger("click");
      expect(mockPush).toHaveBeenCalledWith({ name: "profile" });
      expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    });

    it("logs out from Log out", async () => {
      const auth = useAuthStore();
      auth.logout = vi.fn();
      const wrapper = await openMenu(mountNav());
      await wrapper.find('[data-testid="menu-logout"]').trigger("click");
      expect(auth.logout).toHaveBeenCalled();
    });

    it("closes on Escape and on a click outside", async () => {
      const wrapper = mount(TopNav, { global: { plugins: [pinia] }, attachTo: document.body });
      await openMenu(wrapper);
      await wrapper.find('[data-testid="profile-menu"]').trigger("keydown", { key: "Escape" });
      expect(wrapper.find('[role="menu"]').exists()).toBe(false);

      await openMenu(wrapper);
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      await wrapper.vm.$nextTick();
      expect(wrapper.find('[role="menu"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it("moves between items with the arrow keys", async () => {
      useAuthStore().canUpdate = true;
      const wrapper = mount(TopNav, { global: { plugins: [pinia] }, attachTo: document.body });
      await openMenu(wrapper);
      await wrapper.vm.$nextTick();
      const [settings, admin, logout] = wrapper.findAll('[role="menuitem"]').map((b) => b.element);
      expect(document.activeElement).toBe(settings);
      const menu = wrapper.find('[data-testid="profile-menu"]');
      await menu.trigger("keydown", { key: "ArrowDown" });
      expect(document.activeElement).toBe(admin);
      await menu.trigger("keydown", { key: "ArrowUp" });
      await menu.trigger("keydown", { key: "ArrowUp" });
      expect(document.activeElement).toBe(logout);
      wrapper.unmount();
    });
  });

  it("gives View/Edit and the icon buttons the same height", () => {
    const wrapper = mountNav();
    const sized = [
      wrapper.find('[role="group"][aria-label="Mode"]'),
      wrapper.find('[data-testid="nav-tools-page"]'),
      wrapper.find('[data-testid="nav-search-button"]'),
      wrapper.find('[data-testid="profile-button"]'),
    ];
    for (const el of sized) {
      expect(el.classes()).toEqual(expect.arrayContaining(["h-8", "sm:h-10"]));
    }
  });

  describe("phone search button", () => {
    // A stand-in for View's own search box, visible like the real one
    function addPageSearch() {
      const page = document.createElement("section");
      page.dataset.testid = "view-page";
      page.innerHTML = '<div data-testid="page-search"><input type="search" /></div>';
      document.body.appendChild(page);
      const input = page.querySelector("input");
      Object.defineProperty(input, "offsetParent", { get: () => document.body });
      return { page, input };
    }
    let page;
    afterEach(() => page?.remove());

    it("only shows below md, where the bar has no search box", () => {
      const button = mountNav().find('[data-testid="nav-search-button"]');
      expect(button.classes()).toContain("md:hidden");
      expect(button.find(".mdi-magnify").exists()).toBe(true);
      expect(button.attributes("title")).toBeTruthy();
    });

    it("focuses the floating search bar in place when that's on", async () => {
      mockRoute.name = "dashboard";
      const floating = document.createElement("input");
      floating.dataset.testid = "floating-search-input";
      document.body.appendChild(floating);
      const wrapper = mountNav();
      await wrapper.find('[data-testid="nav-search-button"]').trigger("click");
      expect(document.activeElement).toBe(floating);
      expect(mockPush).not.toHaveBeenCalled();
      floating.remove();
    });

    it("focuses View's search box in place when you're on View", async () => {
      const added = addPageSearch();
      page = added.page;
      const wrapper = mountNav();
      await wrapper.find('[data-testid="nav-search-button"]').trigger("click");
      expect(document.activeElement).toBe(added.input);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("goes to View and focuses its search box from another page", async () => {
      mockRoute.name = "dashboard";
      let added;
      mockPush.mockImplementationOnce(async () => {
        // The stand-in holds the focus (and the phone keyboard) meanwhile
        expect(document.activeElement.tagName).toBe("INPUT");
        added = addPageSearch();
        page = added.page;
      });
      const wrapper = mountNav();
      await wrapper.find('[data-testid="nav-search-button"]').trigger("click");
      await vi.waitFor(() => expect(document.activeElement).toBe(added.input));
      expect(mockPush).toHaveBeenCalledWith({ name: "view" });
      // The stand-in is gone again
      expect(document.querySelectorAll("input").length).toBe(1);
    });
  });

  it("stays at the top while you scroll", () => {
    expect(mountNav().find("header").classes()).toEqual(
      expect.arrayContaining(["sticky", "top-0", "z-30"]),
    );
  });

  describe("desktop tools", () => {
    it("are only in the bar from md up", () => {
      const tools = mountNav().find('[data-testid="nav-tools"]');
      expect(tools.classes()).toEqual(expect.arrayContaining(["hidden", "md:flex"]));
    });

    it("searches in place on View", async () => {
      const wrapper = mountNav();
      await wrapper.find('[data-testid="nav-search"]').setValue("grafana");
      expect(useAppStore().search).toBe("grafana");
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("jumps to View when you search from the dashboard", async () => {
      mockRoute.name = "dashboard";
      const wrapper = mountNav();
      await wrapper.find('[data-testid="nav-search"]').setValue("docs");
      expect(useAppStore().search).toBe("docs");
      expect(mockPush).toHaveBeenCalledWith({ name: "view" });
    });

    it("clears the search on Escape", async () => {
      const wrapper = mountNav();
      const input = wrapper.find('[data-testid="nav-search"]');
      await input.setValue("x");
      await input.trigger("keydown", { key: "Escape" });
      expect(useAppStore().search).toBe("");
    });

    it("opens the new-link form from Add link", async () => {
      const wrapper = mountNav();
      await wrapper.find('[data-testid="nav-add"]').trigger("click");
      // Opens over the current page instead of going to Edit
      expect(mockPush).not.toHaveBeenCalled();
      expect(useLinkEditorStore().link).toEqual({ category_id: "", tags: [] });
    });

    it("focuses the search on / unless you're typing", async () => {
      const wrapper = mountNav();
      const input = wrapper.find('[data-testid="nav-search"]').element;
      // jsdom has no layout, so pretend the box is visible
      Object.defineProperty(input, "offsetParent", { value: document.body });
      const event = new KeyboardEvent("keydown", { key: "/", cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);

      const other = document.createElement("textarea");
      document.body.appendChild(other);
      const typing = new KeyboardEvent("keydown", { key: "/", cancelable: true, bubbles: true });
      other.dispatchEvent(typing);
      expect(typing.defaultPrevented).toBe(false);
      other.remove();
      wrapper.unmount();
    });

    describe("focus on open", () => {
      const setMedia = (desktop) => {
        window.matchMedia = vi.fn().mockReturnValue({ matches: desktop });
      };
      const mountAttached = () =>
        mount(TopNav, { global: { plugins: [pinia] }, attachTo: document.body });
      afterEach(() => {
        delete window.matchMedia;
        document.activeElement?.blur?.();
      });

      it("puts the cursor in the search box with a mouse on a wide screen", () => {
        setMedia(true);
        const wrapper = mountAttached();
        expect(window.matchMedia).toHaveBeenCalledWith(
          "(min-width: 768px) and (pointer: fine)",
        );
        const input = wrapper.find('[data-testid="nav-search"]').element;
        expect(document.activeElement).toBe(input);
        wrapper.unmount();
      });

      it("leaves focus alone on phones and touch screens", () => {
        setMedia(false);
        const wrapper = mountAttached();
        expect(document.activeElement).toBe(document.body);
        wrapper.unmount();
      });

      it("doesn't steal focus from a field or an open dialog", () => {
        setMedia(true);
        const other = document.createElement("input");
        document.body.appendChild(other);
        other.focus();
        let wrapper = mountAttached();
        expect(document.activeElement).toBe(other);
        wrapper.unmount();
        other.remove();

        const dialog = document.createElement("div");
        dialog.setAttribute("role", "dialog");
        document.body.appendChild(dialog);
        wrapper = mountAttached();
        expect(document.activeElement).toBe(document.body);
        wrapper.unmount();
        dialog.remove();
      });
    });

    it("adds a link on N, but not while typing or with a dialog open", async () => {
      const wrapper = mountNav();
      const editor = useLinkEditorStore();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", cancelable: true }));
      expect(editor.link).toEqual({ category_id: "", tags: [] });

      editor.close();
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
      input.remove();

      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      document.body.appendChild(dialog);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
      dialog.remove();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", ctrlKey: true }));
      expect(editor.link).toBeNull();
      wrapper.unmount();
    });

    it("slides away on scroll down and back on scroll up", async () => {
      const wrapper = mountNav();
      const bar = wrapper.find('[data-testid="top-nav"]');
      const scroll = async (y) => {
        window.scrollY = y;
        window.dispatchEvent(new Event("scroll"));
        await new Promise((r) => requestAnimationFrame(r));
        await wrapper.vm.$nextTick();
      };
      await scroll(500);
      expect(bar.classes()).toContain("-translate-y-full");
      await scroll(450);
      expect(bar.classes()).not.toContain("-translate-y-full");
      await scroll(900);
      // Tabbing into it brings it back
      await bar.trigger("focusin");
      expect(bar.classes()).not.toContain("-translate-y-full");
      window.scrollY = 0;
      wrapper.unmount();
    });
  });
});
