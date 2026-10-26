<script setup>
import { ref, watch, nextTick, onUnmounted } from "vue";
import { useContextMenuStore } from "@/stores/contextMenu";

// Renders the menu from the contextMenu store; see stores/contextMenu.js
const menu = useContextMenuStore();
const panel = ref(null);
const position = ref({ left: 0, top: 0 });
const isSheet = ref(false);

function place() {
  isSheet.value = window.innerWidth < 640;
  if (isSheet.value || !panel.value) return;
  // Keep the whole menu on screen
  const { width, height } = panel.value.getBoundingClientRect();
  const margin = 8;
  position.value = {
    left: Math.max(margin, Math.min(menu.x, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(menu.y, window.innerHeight - height - margin)),
  };
}

function focusItem(index) {
  const buttons = panel.value?.querySelectorAll('[role="menuitem"]:not([disabled])');
  if (!buttons?.length) return;
  const count = buttons.length;
  buttons[((index % count) + count) % count].focus();
}

function onKeydown(e) {
  if (e.key === "Escape") {
    e.stopImmediatePropagation();
    menu.close();
    return;
  }
  const buttons = [...(panel.value?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
  const current = buttons.indexOf(document.activeElement);
  if (e.key === "ArrowDown") {
    e.preventDefault();
    focusItem(current + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    focusItem(current - 1);
  } else if (e.key === "Home") {
    e.preventDefault();
    focusItem(0);
  } else if (e.key === "End") {
    e.preventDefault();
    focusItem(-1);
  }
}

function closeOnScroll() {
  if (!isSheet.value) menu.close();
}

function listen(on) {
  const method = on ? "addEventListener" : "removeEventListener";
  window[method]("keydown", onKeydown, true);
  window[method]("resize", menu.close);
  window[method]("scroll", closeOnScroll, true);
}

watch(
  () => [menu.open, menu.x, menu.y, menu.items],
  async ([open]) => {
    listen(false);
    if (!open) return;
    await nextTick();
    place();
    listen(true);
    focusItem(0);
  },
);

onUnmounted(() => listen(false));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="menu.open"
      class="fixed inset-0 z-[85]"
      :class="isSheet ? 'bg-black/40' : ''"
      data-testid="context-menu-backdrop"
      @click.self="menu.close()"
      @contextmenu.prevent.self="menu.close()"
    >
      <div
        ref="panel"
        role="menu"
        :aria-label="menu.title || 'Actions'"
        class="bg-white dark:bg-brand-900 border border-gray-200 dark:border-brand-700 shadow-xl py-1 text-sm"
        :class="
          isSheet
            ? 'absolute inset-x-0 bottom-0 rounded-t-2xl pb-[max(0.5rem,env(safe-area-inset-bottom))]'
            : 'fixed min-w-48 max-w-72 rounded-lg'
        "
        :style="isSheet ? undefined : { left: `${position.left}px`, top: `${position.top}px` }"
      >
        <p
          v-if="menu.title"
          class="px-3 pt-1.5 pb-1 text-xs font-medium text-gray-500 dark:text-brand-400 truncate"
          :class="{ 'px-4 pt-3 pb-2 text-sm': isSheet }"
        >
          {{ menu.title }}
        </p>
        <template v-for="(item, i) in menu.items" :key="i">
          <hr
            v-if="item.divider"
            class="my-1 border-gray-200 dark:border-brand-800"
          />
          <button
            v-else
            type="button"
            role="menuitem"
            class="w-full flex items-center gap-2.5 text-left hover:bg-gray-100 dark:hover:bg-brand-800 focus:bg-gray-100 dark:focus:bg-brand-800 outline-hidden disabled:opacity-40"
            :class="[
              isSheet ? 'px-4 py-3 text-base' : 'px-3 py-1.5',
              item.danger
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-800 dark:text-brand-100',
            ]"
            :disabled="item.disabled"
            :title="item.title || item.label"
            @click="menu.run(item)"
          >
            <i
              class="mdi text-lg leading-none w-5 text-center"
              :class="item.icon || 'mdi-circle-small'"
              aria-hidden="true"
            ></i>
            <span class="flex-1 truncate">{{ item.label }}</span>
          </button>
        </template>
        <button
          v-if="isSheet"
          type="button"
          class="w-full mt-1 px-4 py-3 text-base text-center border-t border-gray-200 dark:border-brand-800 text-gray-600 dark:text-brand-300"
          title="Close the menu"
          @click="menu.close()"
        >
          Cancel
        </button>
      </div>
    </div>
  </Teleport>
</template>
