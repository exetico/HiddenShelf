import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SearchField from "@/components/common/SearchField.vue";

describe("SearchField", () => {
  const mountField = (props = {}) => {
    const wrapper = mount(SearchField, {
      props: {
        modelValue: "",
        "onUpdate:modelValue": (v) => wrapper.setProps({ modelValue: v }),
        ...props,
      },
      attrs: { "data-testid": "box" },
      attachTo: document.body,
    });
    return wrapper;
  };

  it("shows a clear button only when there is text, and clears", async () => {
    const wrapper = mountField();
    expect(wrapper.find('[data-testid="search-clear"]').exists()).toBe(false);
    await wrapper.find("input").setValue("grafana");
    const clear = wrapper.find('[data-testid="search-clear"]');
    expect(clear.attributes("title")).toBe("Clear the search");
    // A solid chip, not the browser's faint little x
    expect(clear.classes()).toEqual(expect.arrayContaining(["bg-gray-200", "dark:bg-brand-600"]));
    await clear.trigger("click");
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([""]);
    expect(document.activeElement).toBe(wrapper.find("input").element);
    wrapper.unmount();
  });

  it("clears on Escape and puts attributes on the input", async () => {
    const wrapper = mountField({ modelValue: "x" });
    const input = wrapper.find('[data-testid="box"]');
    expect(input.element.tagName).toBe("INPUT");
    await input.trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([""]);
    wrapper.unmount();
  });

  it("shows the hint while empty", async () => {
    const wrapper = mountField({ hint: "/" });
    expect(wrapper.find("kbd").text()).toBe("/");
    await wrapper.find("input").setValue("a");
    expect(wrapper.find("kbd").exists()).toBe(false);
    wrapper.unmount();
  });
});
