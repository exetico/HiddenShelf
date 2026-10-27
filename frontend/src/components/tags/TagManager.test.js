import { beforeEach, describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useDialogStore } from "@/stores/dialog";
import TagManager from "@/components/tags/TagManager.vue";
import CategoryManager from "@/components/categories/CategoryManager.vue";

const TAGS = [
  { id: 9, name: "infra", usage_count: 12 },
  { id: 4, name: "spare", usage_count: 0 },
  { id: 5, name: "one", usage_count: 1 },
];

describe("TagManager", () => {
  let pinia;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  const mountManager = (tags = TAGS) =>
    mount(TagManager, {
      props: { open: true, tags },
      global: { plugins: [pinia], stubs: { Teleport: true } },
    });
  const button = (wrapper, text, index = 0) =>
    wrapper.findAll("button").filter((b) => b.text() === text)[index];

  it("says what it is and shows how many links use each tag", () => {
    const wrapper = mountManager();
    expect(wrapper.text()).toContain("Manage tags");
    expect(wrapper.text()).toContain("Pick a tag to see its links");
    const rows = wrapper.findAll('[data-testid="tag-row"]').map((r) => r.text());
    expect(rows[0]).toContain("#infra");
    expect(rows[0]).toContain("12 links");
    expect(rows[1]).toContain("0 links");
    expect(rows[2]).toContain("1 link");
    expect(rows[2]).not.toContain("1 links");
  });

  it("shows a tag's links when its name is picked", async () => {
    const wrapper = mountManager();
    await wrapper.find('[title="Show links tagged infra"]').trigger("click");
    expect(wrapper.emitted("filter")).toEqual([[9]]);
  });

  it("adds a tag from the same Add button as categories", async () => {
    const wrapper = mountManager();
    expect(wrapper.find('[data-testid="create-tag-form"]').exists()).toBe(false);
    await wrapper.find('[data-testid="add-tag"]').trigger("click");
    await wrapper.find('input[placeholder="Tag name"]').setValue("home");
    await wrapper.find('[data-testid="create-tag-form"]').trigger("submit");
    expect(wrapper.emitted("create")).toEqual([["home"]]);
    expect(wrapper.find('[data-testid="create-tag-form"]').exists()).toBe(false);
  });

  it("renames a tag in place, and only when the name changed", async () => {
    const wrapper = mountManager();
    await button(wrapper, "Edit").trigger("click");
    const input = wrapper.find('[data-testid="tag-row"] input');
    expect(input.element.value).toBe("infra");
    await wrapper.find('[data-testid="tag-row"] form').trigger("submit");
    expect(wrapper.emitted("rename")).toBeFalsy();

    await button(wrapper, "Edit").trigger("click");
    await wrapper.find('[data-testid="tag-row"] input').setValue(" servers ");
    await wrapper.find('[data-testid="tag-row"] form').trigger("submit");
    expect(wrapper.emitted("rename")).toEqual([[9, "servers"]]);
  });

  it("says how many links lose the tag before deleting it", async () => {
    const wrapper = mountManager();
    await button(wrapper, "Delete").trigger("click");
    const dialog = useDialogStore();
    expect(dialog.current).toMatchObject({ title: 'Delete tag "infra"?', danger: true });
    expect(dialog.current.message).toContain("It comes off 12 links. The links themselves stay.");

    dialog.close(false);
    await flushPromises();
    expect(wrapper.emitted("remove")).toBeFalsy();

    await button(wrapper, "Delete", 1).trigger("click");
    expect(dialog.current.message).toContain("No links use it.");
    dialog.close(true);
    await flushPromises();
    expect(wrapper.emitted("remove")).toEqual([[4]]);
  });

  it("explains where tags come from when there are none", () => {
    expect(mountManager([]).text()).toContain("No tags yet");
  });

  it("looks like the categories manager", () => {
    const tags = mountManager();
    const categories = mount(CategoryManager, {
      props: { open: true, categories: [{ id: 1, name: "Work", link_count: 2 }] },
      global: { plugins: [pinia], stubs: { Teleport: true } },
    });
    const tagRow = tags.find('[data-testid="tag-row"]');
    const categoryRow = categories.find('[data-testid="category-row"]');
    // Same row frame, the same text actions, and the same Add button
    expect(tagRow.classes()).toEqual(categoryRow.classes());
    for (const text of ["Edit", "Delete"]) {
      const a = tagRow.findAll("button").find((b) => b.text() === text);
      const b = categoryRow.findAll("button").find((x) => x.text() === text);
      expect(a.classes()).toEqual(b.classes());
    }
    expect(tags.find('[data-testid="add-tag"]').classes()).toEqual(
      categories.find('[data-testid="add-category"]').classes(),
    );
  });

  it("filters a long list of tags by name", async () => {
    const many = ["infra", "home", "work", "recipes", "finance", "family", "Infra-lab"].map(
      (name, i) => ({ id: i + 1, name, usage_count: 1 }),
    );
    const wrapper = mountManager(many);
    await wrapper.find('[data-testid="manager-filter"]').setValue("INFRA");
    expect(wrapper.findAll('[data-testid="tag-row"]').map((r) => r.text().split("\n")[0])).toEqual([
      expect.stringContaining("#infra"),
      expect.stringContaining("#Infra-lab"),
    ]);
    await wrapper.find('[data-testid="manager-filter"]').setValue("zzz");
    expect(wrapper.text()).toContain('No tags match "zzz"');
  });

  it("has no filter box for a short list", () => {
    expect(mountManager().find('[data-testid="manager-filter"]').exists()).toBe(false);
  });

  it("links each tag to its filtered list", () => {
    expect(mountManager().find('[data-testid="tag-filter"]').attributes("href")).toBe("/edit?tag=9");
  });
});
