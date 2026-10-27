import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { FAQ, FEATURE_GROUPS, FRONT_FEATURES } from "@/content/features";
import HelpView from "@/views/HelpView.vue";

vi.mock("vue-router", async () => {
  const { h } = await vi.importActual("vue");
  return {
    RouterLink: { props: ["to"], setup: (props, { slots }) => () => h("a", { href: props.to }, slots.default?.()) },
  };
});

describe("HelpView", () => {
  let pinia;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });
  const mountHelp = () => mount(HelpView, { global: { plugins: [pinia] } });

  it("lists every feature, grouped, and every question", () => {
    const wrapper = mountHelp();
    const count = FEATURE_GROUPS.reduce((n, g) => n + g.features.length, 0);
    expect(wrapper.findAll('[data-testid="help-feature"]')).toHaveLength(count);
    expect(wrapper.findAll("h2").map((h) => h.text())).toEqual([
      ...FEATURE_GROUPS.map((g) => g.title),
      "Frequently asked questions",
    ]);
    const faq = wrapper.findAll('[data-testid="help-faq"]');
    expect(faq).toHaveLength(FAQ.length);
    expect(faq[0].find("summary").text()).toBe(FAQ[0].q);
  });

  it("offers the way back to sign in only when signed out", () => {
    expect(mountHelp().find('[data-testid="help-sign-in"]').attributes("href")).toBe("/login");
    useAuthStore().user = { email: "t@example.com" };
    expect(mountHelp().find('[data-testid="help-sign-in"]').exists()).toBe(false);
  });
});

describe("feature list", () => {
  const all = FEATURE_GROUPS.flatMap((g) => g.features);

  it("gives every feature an icon, a title and a sentence", () => {
    for (const f of all) {
      expect(f.icon).toMatch(/^mdi-/);
      expect(f.title.length).toBeGreaterThan(3);
      expect(f.text).toMatch(/\.$/);
    }
    expect(new Set(all.map((f) => f.title)).size).toBe(all.length);
  });

  it("keeps the front page short", () => {
    expect(FRONT_FEATURES.length).toBeGreaterThanOrEqual(3);
    expect(FRONT_FEATURES.length).toBeLessThanOrEqual(9);
  });

  it("answers every question in full sentences", () => {
    for (const item of FAQ) {
      expect(item.q).toMatch(/\?$/);
      expect(item.a).toMatch(/\.$/);
    }
  });
});
