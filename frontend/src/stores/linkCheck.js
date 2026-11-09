import { defineStore } from "pinia";
import { linksApi } from "@/services/api/linksApi";
import { ownLinks } from "@/lib/shelfTools";

// The server checks at most this many links per request
export const CHECK_BATCH = 20;

/**
 * The "Check links" tool's run: kept here so the results stay while you
 * fix links, open other tools, or go to another page and come back.
 */
export const useLinkCheckStore = defineStore("linkCheck", {
  state: () => ({
    running: false,
    done: 0,
    total: 0,
    // link id → { status, code, reason, final_url, url }
    results: {},
    checkedAt: null,
    error: "",
    stopRequested: false,
  }),
  getters: {
    counts(state) {
      const counts = { ok: 0, moved: 0, broken: 0, unsure: 0, skipped: 0 };
      for (const r of Object.values(state.results)) counts[r.status] = (counts[r.status] || 0) + 1;
      return counts;
    },
    hasRun: (state) => state.checkedAt !== null || state.running,
  },
  actions: {
    /** Checks these links (your own), CHECK_BATCH at a time */
    async run(links) {
      if (this.running) return;
      const ids = ownLinks(links).map((l) => l.id);
      this.running = true;
      this.stopRequested = false;
      this.error = "";
      this.results = {};
      this.done = 0;
      this.total = ids.length;
      try {
        for (let i = 0; i < ids.length && !this.stopRequested; i += CHECK_BATCH) {
          const batch = ids.slice(i, i + CHECK_BATCH);
          const results = await linksApi.check(batch);
          for (const r of results) this.results[r.id] = r;
          this.done += batch.length;
        }
      } catch (error) {
        this.error = error.message || "The check stopped";
      } finally {
        this.running = false;
        this.checkedAt = Date.now();
      }
    },
    stop() {
      this.stopRequested = true;
    },
    /** Forget a link's result once it's fixed or trashed */
    clear(id) {
      delete this.results[id];
    },
  },
});
