<script setup>
/**
 * Server updates, for admins listed in UPDATE_ADMIN_EMAILS.
 *
 * Shows the running version and what an update would bring in, and starts
 * an update or a rollback. The container updates itself; this page only
 * asks (sending nothing but the click) and then follows its progress.
 */
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { updatesApi } from "@/services/api/updatesApi";
import { useAuthStore } from "@/stores/auth";
import { useDialogStore } from "@/stores/dialog";
import { useToastStore } from "@/stores/toast";

const authStore = useAuthStore();
const dialog = useDialogStore();
const toast = useToastStore();

const status = ref(null);
const loadError = ref("");
const busy = ref(false);
// Set after a click, until the updater reports a result for that request
const waitingFor = ref(null);
let timer = null;

const short = (commit) => (commit ? commit.slice(0, 7) : "");
function when(seconds) {
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const job = computed(() => status.value?.job || null);
const running = computed(
  () => Boolean(waitingFor.value) || job.value?.state === "running",
);
const available = computed(() => status.value?.available || { count: 0, commits: [] });
const lastResult = computed(() =>
  job.value && job.value.state !== "running" ? job.value : null,
);

const RESULT_TEXT = {
  succeeded: "Finished",
  failed: "Failed",
  rolled_back: "Rolled back",
};

async function load() {
  try {
    status.value = await updatesApi.status();
    loadError.value = "";
    if (waitingFor.value) {
      // The request's own row in the history gets the updater's result
      const row = status.value.history?.find((h) => h.id === waitingFor.value);
      if (row?.result) {
        waitingFor.value = null;
        if (row.result === "succeeded") {
          toast.success("Done. Reloading the app…");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast.error(row.message || "The update did not finish.");
        }
      }
    }
  } catch (e) {
    // While the app restarts the server can't answer; keep waiting
    if (!running.value) loadError.value = e.message || "Could not load the update status.";
  }
  schedule();
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(load, running.value ? 3000 : 60000);
}

async function signInAgain() {
  const ok = await dialog.confirm({
    title: "Sign in again",
    message: `To update the app, you need to have signed in within the last ${status.value?.reauth_minutes || 10} minutes. Sign out and sign in again, then come back here.`,
    confirmText: "Sign out",
  });
  if (!ok) return;
  try {
    sessionStorage.setItem("hiddenshelf_return_to", "/profile#updates");
  } catch {
    /* storage blocked: you land on the dashboard instead */
  }
  await authStore.logout();
}

async function start(action) {
  if (!status.value?.fresh_login) return signInAgain();
  const s = status.value;
  const ok =
    action === "update"
      ? await dialog.confirm({
          title: "Update the app?",
          message: `This installs the latest version on ${s.branch} (${s.available.count} change${s.available.count === 1 ? "" : "s"} when last checked). Building it takes a minute or two while the site stays up. The database is backed up first, the site is offline for a few seconds, and it goes back to the current version by itself if the new one doesn't start.`,
          confirmText: "Update",
        })
      : await dialog.confirm({
          title: "Roll back?",
          message: s.rollback?.restores_database
            ? `This goes back to ${short(s.rollback.commit)}. That update changed the database, so the database goes back to how it was before the update too: anything saved since then is lost. A copy of today's database is kept in db/backups on the server.`
            : `This goes back to ${short(s.rollback?.commit)}. Your data stays as it is.`,
          confirmText: "Roll back",
          danger: true,
        });
  if (!ok) return;

  busy.value = true;
  try {
    const { id } =
      action === "update"
        ? await updatesApi.update()
        : await updatesApi.rollback();
    waitingFor.value = id;
    toast.success(action === "update" ? "Update started" : "Rollback started");
  } catch (e) {
    if (e.data?.reauth_required) {
      status.value = { ...status.value, fresh_login: false };
      await signInAgain();
    } else {
      toast.error(e.message || "Could not start.");
    }
  } finally {
    busy.value = false;
    schedule();
  }
}

onMounted(load);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <article
    id="updates"
    class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5 space-y-4 scroll-mt-16 sm:scroll-mt-20"
    data-testid="server-updates"
  >
    <div>
      <h2 class="text-lg font-semibold">Server updates</h2>
      <p class="text-sm text-gray-500 dark:text-brand-400">
        Only admins see this. Updates bring in the latest version from GitHub.
      </p>
    </div>

    <p v-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
    <p v-else-if="!status" class="text-sm text-gray-500 dark:text-brand-400">Loading…</p>

    <template v-else>
      <!-- Version -->
      <dl class="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="update-version">
        <dt class="text-gray-500 dark:text-brand-400">Running</dt>
        <dd>
          <template v-if="status.current">
            <code>{{ short(status.current.commit) }}</code>
            {{ status.current.subject }}
            <span class="text-gray-500 dark:text-brand-400">· {{ when(status.current.date) }}</span>
          </template>
          <template v-else-if="status.built_commit"><code>{{ short(status.built_commit) }}</code></template>
          <template v-else>Unknown</template>
        </dd>
        <dt class="text-gray-500 dark:text-brand-400">Last checked</dt>
        <dd>{{ status.checked_at ? when(status.checked_at) : "Never" }}</dd>
      </dl>

      <p
        v-if="!status.updater_seen"
        class="text-sm rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-3"
        data-testid="updater-missing"
      >
        The updater hasn't checked in yet. It starts with the app when
        <code>UPDATE_ADMIN_EMAILS</code> is set; give it a minute after
        <code>make up</code>, then reload.
      </p>
      <p
        v-else-if="status.updater_stale"
        class="text-sm rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-3"
      >
        The updater hasn't checked in for a few hours. Check the app's logs
        on the server (<code>make logs</code>).
      </p>
      <p
        v-if="status.check_error"
        class="text-sm rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-3"
      >
        {{ status.check_error }}
      </p>

      <!-- Progress -->
      <div
        v-if="running"
        class="text-sm rounded-md bg-brand-50 dark:bg-brand-800 p-3 flex items-center gap-2"
        data-testid="update-progress"
        role="status"
      >
        <i class="mdi mdi-loading mdi-spin" aria-hidden="true"></i>
        <span>{{ job?.state === "running" ? job.step : "Waiting for the updater to start…" }}</span>
      </div>

      <!-- What's new -->
      <div v-if="available.count > 0" class="space-y-2" data-testid="update-available">
        <p class="text-sm font-medium">
          {{ available.count }} new change{{ available.count === 1 ? "" : "s" }} on {{ status.branch }}
        </p>
        <ul class="text-sm space-y-1 max-h-48 overflow-y-auto">
          <li v-for="c in available.commits" :key="c.commit" class="flex gap-2">
            <code class="text-gray-500 dark:text-brand-400">{{ short(c.commit) }}</code>
            <span class="min-w-0 break-words">{{ c.subject }}</span>
          </li>
        </ul>
        <p v-if="available.migrations" class="text-xs text-gray-500 dark:text-brand-400">
          This update changes the database. It is backed up first.
        </p>
      </div>
      <p v-else-if="status.updater_seen && status.check_ok" class="text-sm text-gray-600 dark:text-brand-300">
        You're on the latest version.
      </p>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          title="Back up, update to the latest version and restart"
          class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="busy || running || !status.check_ok || available.count === 0"
          data-testid="update-button"
          @click="start('update')"
        >
          <i class="mdi mdi-update mr-1" aria-hidden="true"></i>
          Update
        </button>
        <button
          v-if="status.rollback"
          type="button"
          :title="`Go back to ${short(status.rollback.commit)}, the version before the last update`"
          class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700 hover:bg-gray-50 dark:hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="busy || running"
          data-testid="rollback-button"
          @click="start('rollback')"
        >
          <i class="mdi mdi-undo mr-1" aria-hidden="true"></i>
          Roll back to {{ short(status.rollback.commit) }}
        </button>
      </div>
      <p v-if="!status.fresh_login" class="text-xs text-gray-500 dark:text-brand-400">
        You'll be asked to sign in again first.
      </p>

      <!-- Last result -->
      <div v-if="lastResult" class="text-sm space-y-1" data-testid="update-result">
        <p>
          <span class="font-medium">Last {{ lastResult.action }}:</span>
          {{ RESULT_TEXT[lastResult.state] }} · {{ when(lastResult.finished_at) }}
        </p>
        <p v-if="lastResult.message" class="text-gray-600 dark:text-brand-300">{{ lastResult.message }}</p>
      </div>
      <details v-if="status.log" class="text-sm">
        <summary class="cursor-pointer text-gray-600 dark:text-brand-300">Log of the last run</summary>
        <pre class="mt-2 p-3 rounded-md bg-gray-50 dark:bg-brand-950 text-xs overflow-x-auto whitespace-pre-wrap">{{ status.log }}</pre>
      </details>

      <!-- Audit log -->
      <details v-if="status.history?.length" class="text-sm">
        <summary class="cursor-pointer text-gray-600 dark:text-brand-300">Who updated when</summary>
        <ul class="mt-2 space-y-1" data-testid="update-history">
          <li v-for="h in status.history" :key="h.id" class="text-gray-700 dark:text-brand-200">
            {{ when(h.created_at) }} · {{ h.email }} ·
            {{ h.action === "rollback" ? "Roll back" : `Update to ${short(h.target_commit)}` }} ·
            {{ h.result ? RESULT_TEXT[h.result] || h.result : "Waiting" }}
          </li>
        </ul>
      </details>
    </template>
  </article>
</template>
