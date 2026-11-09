<script setup>
/**
 * Server updates, for admins listed in UPDATE_ADMIN_EMAILS.
 *
 * Shows the running version and what an update would bring in, and starts
 * an update or a rollback. The container updates itself; this page only
 * asks (sending nothing but the click) and then follows its progress.
 * The server looks for new versions hourly; "Check for updates" asks now.
 * It follows either releases (vX.Y.Z tags on main) or every change on main
 * (UPDATE_CHANNEL on the server).
 *
 * Updating needs a recent sign-in. When it is too old, the panel asks you
 * to confirm who you are (Google, or a link by email) and brings you back
 * here, still signed in the whole time.
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { updatesApi } from "@/services/api/updatesApi";
import { authApi } from "@/services/api/authApi";
import { configApi } from "@/services/api/configApi";
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
// Set after "Check for updates", until a newer check result arrives
const checking = ref(false);
let checkSince = 0;
let checkGiveUpAt = 0;
let timer = null;
// Confirming who you are: the sign-in methods the server offers
const methods = ref({ email: false, google: false });
const reauthBusy = ref(false);
const linkSentTo = ref("");
const reauthBox = ref(null);
const RETURN_TO = "#/admin";

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
const releases = computed(() => status.value?.channel !== "main");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
// "v1.2.0" when it is a release, else the short commit
const versionName = (v) => v?.tag || short(v?.commit);

/** One line on what an update would bring in, for the panel and the toast. */
const availableText = computed(() => {
  const a = available.value;
  if (!a.count) return "";
  return releases.value && a.target_tag
    ? `${a.target_tag} is available (${plural(a.count, "change")})`
    : `${plural(a.count, "new change")} on ${status.value.branch}`;
});

/** Why there is nothing to install, when the check worked. */
const upToDateText = computed(() => {
  const a = available.value;
  if (!releases.value) return "You're on the latest version.";
  if (!a.target_tag) return "There are no releases yet. Publish one on GitHub to update from here.";
  if (a.ahead) return `You're on a newer version than the latest release (${a.target_tag}).`;
  return `You're on the latest release (${a.target_tag}).`;
});

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
    if (checking.value) {
      if ((status.value.checked_at || 0) > checkSince) {
        checking.value = false;
        if (!status.value.check_ok) toast.error(status.value.check_error || "Could not check for updates.");
        else toast.success(availableText.value ? `${availableText.value}.` : upToDateText.value);
      } else if (Date.now() > checkGiveUpAt) {
        checking.value = false;
        toast.error("The updater didn't answer. Try again in a minute.");
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
  timer = setTimeout(load, running.value || checking.value ? 3000 : 60000);
}

async function checkNow() {
  busy.value = true;
  try {
    const res = await updatesApi.check();
    checkSince = res.checked_at || 0;
    checkGiveUpAt = Date.now() + 60_000;
    checking.value = true;
  } catch (e) {
    toast.error(e.message || "Could not check for updates.");
  } finally {
    busy.value = false;
    schedule();
  }
}

/** Show the "confirm it's you" box (it is there whenever the sign-in is too old). */
async function askToConfirm() {
  status.value = { ...status.value, fresh_login: false };
  await nextTick();
  reauthBox.value?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}

async function confirmWithGoogle() {
  reauthBusy.value = true;
  try {
    window.location.assign(await authApi.googleSignInUrl({ returnTo: RETURN_TO }));
  } catch (e) {
    toast.error(e.message || "Could not open Google sign-in.");
    reauthBusy.value = false;
  }
}

async function confirmByEmail() {
  const email = authStore.user?.email;
  if (!email) return;
  reauthBusy.value = true;
  try {
    await authApi.sendMagicLink(email, { returnTo: RETURN_TO });
    linkSentTo.value = email;
  } catch (e) {
    toast.error(e.message || "Could not send the link.");
  } finally {
    reauthBusy.value = false;
  }
}

async function start(action) {
  if (!status.value?.fresh_login) return askToConfirm();
  const s = status.value;
  const ok =
    action === "update"
      ? await dialog.confirm({
          title: "Update the app?",
          message: `This installs ${releases.value && s.available.target_tag ? s.available.target_tag : `the latest version on ${s.branch}`} (${plural(s.available.count, "change")} when last checked). Building it takes a minute or two while the site stays up. The database is backed up first, the site is offline for a few seconds, and it goes back to the current version by itself if the new one doesn't start.`,
          confirmText: "Update",
        })
      : await dialog.confirm({
          title: "Roll back?",
          message: s.rollback?.restores_database
            ? `This goes back to ${versionName(s.rollback)}. That update changed the database, so the database goes back to how it was before the update too: anything saved since then is lost. A copy of today's database is kept in db/backups on the server.`
            : `This goes back to ${versionName(s.rollback)}. Your data stays as it is.`,
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
      await askToConfirm();
    } else {
      toast.error(e.message || "Could not start.");
    }
  } finally {
    busy.value = false;
    schedule();
  }
}

async function loadMethods() {
  try {
    const cfg = await configApi.get();
    methods.value = { email: cfg.email_login_enabled !== false, google: Boolean(cfg.google_auth_enabled) };
  } catch {
    methods.value = { email: true, google: false };
  }
}

onMounted(() => {
  load();
  loadMethods();
});
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
        Only admins see this. Updates bring in a new version from GitHub.
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
            <span v-if="status.current.tag" class="font-medium" data-testid="current-tag">{{ status.current.tag }}</span>
            <code v-else>{{ short(status.current.commit) }}</code>
            {{ status.current.subject }}
            <span class="text-gray-500 dark:text-brand-400">· {{ when(status.current.date) }}</span>
          </template>
          <template v-else-if="status.built_commit"><code>{{ short(status.built_commit) }}</code></template>
          <template v-else>Unknown</template>
        </dd>
        <dt class="text-gray-500 dark:text-brand-400">Follows</dt>
        <dd data-testid="update-channel">
          <template v-if="releases">Releases <span class="text-gray-500 dark:text-brand-400">(recommended)</span></template>
          <template v-else>Every change on {{ status.branch }}</template>
          <details class="inline-block align-top ml-1">
            <summary class="cursor-pointer text-xs text-gray-500 dark:text-brand-400">What's this?</summary>
            <p class="text-xs text-gray-600 dark:text-brand-300 mt-1 max-w-prose">
              <template v-if="releases">
                Update installs only versions you publish as a release (a tag like
                <code>v1.2.0</code> on {{ status.branch }}), so a merge never reaches the
                server by accident.
              </template>
              <template v-else>
                Update installs whatever is on {{ status.branch }}, as soon as it is merged.
                Following releases is safer:
              </template>
              Change it with <code>UPDATE_CHANNEL</code> (<code>releases</code> or
              <code>main</code>) in <code>.env</code>, then run <code>make up</code>.
            </p>
          </details>
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
        <p class="text-sm font-medium">{{ availableText }}</p>
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
      <p v-else-if="status.updater_seen && status.check_ok" class="text-sm text-gray-600 dark:text-brand-300" data-testid="up-to-date">
        {{ upToDateText }}
      </p>

      <!-- Too long since sign-in: confirm who you are, without signing out -->
      <div
        v-if="!status.fresh_login && status.updater_seen"
        ref="reauthBox"
        class="text-sm rounded-md border border-gray-200 dark:border-brand-700 p-3 space-y-2"
        data-testid="reauth"
      >
        <p class="font-medium">
          <i class="mdi mdi-shield-account-outline mr-1" aria-hidden="true"></i>
          Confirm it's you to update
        </p>
        <p class="text-gray-600 dark:text-brand-300">
          Updating and rolling back need a sign-in from the last
          {{ status.reauth_minutes || 10 }} minutes. You stay signed in, and come back here after.
        </p>
        <p v-if="linkSentTo" class="text-gray-700 dark:text-brand-200" data-testid="reauth-sent">
          We sent a link to <strong>{{ linkSentTo }}</strong>. Open it to continue.
        </p>
        <div v-else class="flex flex-wrap gap-2">
          <button
            v-if="methods.google"
            type="button"
            title="Confirm with your Google account and come back here"
            class="px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            :disabled="reauthBusy"
            data-testid="reauth-google"
            @click="confirmWithGoogle"
          >
            <i class="mdi mdi-google mr-1" aria-hidden="true"></i>
            Continue with Google
          </button>
          <button
            v-if="methods.email"
            type="button"
            title="Get a sign-in link by email that brings you back here"
            class="px-3 py-1.5 rounded-md border border-gray-300 dark:border-brand-700 hover:bg-gray-50 dark:hover:bg-brand-800 disabled:opacity-50"
            :disabled="reauthBusy"
            data-testid="reauth-email"
            @click="confirmByEmail"
          >
            <i class="mdi mdi-email-outline mr-1" aria-hidden="true"></i>
            Email me a link
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
:title="status.fresh_login ? 'Back up, update to the new version and restart' : 'Confirm it\'s you first (above)'"
          class="px-4 py-2 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="busy || running || !status.fresh_login || !status.check_ok || available.count === 0"
          data-testid="update-button"
          @click="start('update')"
        >
          <i class="mdi mdi-update mr-1" aria-hidden="true"></i>
          Update
        </button>
        <button
          type="button"
          title="Look for a new version on GitHub now instead of waiting for the hourly check"
          class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700 hover:bg-gray-50 dark:hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="busy || running || checking || !status.updater_seen"
          data-testid="check-button"
          @click="checkNow"
        >
          <i class="mdi mr-1" :class="checking ? 'mdi-loading mdi-spin' : 'mdi-refresh'" aria-hidden="true"></i>
          {{ checking ? "Checking…" : "Check for updates" }}
        </button>
        <button
          v-if="status.rollback"
          type="button"
:title="status.fresh_login ? `Go back to ${versionName(status.rollback)}, the version before the last update` : 'Confirm it\'s you first (above)'"
          class="px-4 py-2 rounded-md border border-gray-300 dark:border-brand-700 hover:bg-gray-50 dark:hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="busy || running || !status.fresh_login"
          data-testid="rollback-button"
          @click="start('rollback')"
        >
          <i class="mdi mdi-undo mr-1" aria-hidden="true"></i>
          Roll back to {{ versionName(status.rollback) }}
        </button>
      </div>

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
