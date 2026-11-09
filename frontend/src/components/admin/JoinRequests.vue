<script setup>
/**
 * Who can join, on the Admin page. Shows the sign-up mode (SIGNUP_MODE on
 * the server), the people asking to join (approve or deny), and the emails
 * let in ahead of time. Notes are the requesters' own words, shown as text.
 */
import { ref, computed, onMounted } from "vue";
import { accessApi } from "@/services/api/accessApi";
import { useDialogStore } from "@/stores/dialog";
import { useToastStore } from "@/stores/toast";

const dialog = useDialogStore();
const toast = useToastStore();

const data = ref(null);
const loadError = ref("");
const busyId = ref(null);
const newEmail = ref("");
const inviting = ref(false);

const MODES = {
  open: "Anyone who signs in gets an account.",
  approval: "New people ask to join, and an admin approves them. Emails on the list below join right away.",
  invite: "Only emails on the list below can make an account. Nobody can ask.",
};

const entries = computed(() => data.value?.entries || []);
const waiting = computed(() => entries.value.filter((e) => e.status === "pending"));
const invited = computed(() => entries.value.filter((e) => e.status === "approved"));
const denied = computed(() => entries.value.filter((e) => e.status === "denied"));
// approval was chosen, but nobody can approve without UPDATE_ADMIN_EMAILS
const noAdmins = computed(
  () => data.value?.configured_mode === "approval" && data.value?.mode === "invite",
);

function when(seconds) {
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function load() {
  try {
    data.value = await accessApi.adminList();
    loadError.value = "";
  } catch (error) {
    loadError.value = error.message || "Couldn't load the list";
  }
}

async function act(entry, action, message) {
  busyId.value = entry.id;
  try {
    await accessApi[action](entry.id);
    toast.success(message);
    await load();
  } catch (error) {
    toast.error(error.message || "That didn't work");
  } finally {
    busyId.value = null;
  }
}

const approve = (e) => act(e, "approve", `${e.email} can join now. They'll get an email.`);
const deny = (e) => act(e, "deny", `Denied ${e.email}`);

async function remove(entry) {
  const ok = await dialog.confirm({
    title: "Remove from the list?",
    message:
      entry.status === "denied"
        ? `${entry.email} will be able to ask to join again.`
        : `${entry.email} won't be able to make an account unless sign-up is open.`,
    confirmText: "Remove",
    danger: true,
  });
  if (ok) await act(entry, "remove", `Removed ${entry.email}`);
}

async function inviteEmail() {
  const email = newEmail.value.trim();
  if (!email) return;
  inviting.value = true;
  try {
    await accessApi.invite(email);
    toast.success(`${email} can join now. Let them know; no email is sent.`);
    newEmail.value = "";
    await load();
  } catch (error) {
    toast.error(error.message || "Couldn't add that email");
  } finally {
    inviting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <article
    id="join"
    class="bg-white dark:bg-brand-900 rounded-lg border border-gray-200 dark:border-brand-800 p-5 space-y-4 scroll-mt-16 sm:scroll-mt-20"
    data-testid="join-requests"
  >
    <div>
      <h2 class="text-lg font-semibold">
        Who can join
        <span
          v-if="waiting.length"
          class="ml-1 align-middle text-xs font-medium rounded-full bg-brand-500 text-white px-2 py-0.5"
          data-testid="waiting-count"
        >{{ waiting.length }} waiting</span>
      </h2>
      <p v-if="data" class="text-sm text-gray-500 dark:text-brand-400" data-testid="join-mode">
        {{ MODES[data.mode] }}
        Change it with <code>SIGNUP_MODE</code> (<code>open</code>, <code>approval</code> or
        <code>invite</code>) in <code>.env</code>, then run <code>make up</code>.
      </p>
    </div>

    <p v-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
    <p v-else-if="!data" class="text-sm text-gray-500 dark:text-brand-400">Loading…</p>

    <template v-else>
      <p
        v-if="noAdmins"
        class="text-sm rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-3"
      >
        Asking to join is off because no admin is set in <code>UPDATE_ADMIN_EMAILS</code>.
      </p>

      <!-- Waiting -->
      <section v-if="waiting.length" aria-label="Asking to join" class="space-y-2">
        <h3 class="text-sm font-semibold">Asking to join</h3>
        <ul class="divide-y divide-gray-100 dark:divide-brand-800">
          <li
            v-for="e in waiting"
            :key="e.id"
            class="py-2 flex flex-col sm:flex-row sm:items-start gap-2"
            data-testid="waiting-entry"
          >
            <div class="flex-1 min-w-0">
              <p class="font-medium break-all">{{ e.email }}</p>
              <p v-if="e.note" class="text-sm text-gray-600 dark:text-brand-300 whitespace-pre-line break-words">{{ e.note }}</p>
              <p class="text-xs text-gray-500 dark:text-brand-400">Asked {{ when(e.created_at) }}</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                :title="`Let ${e.email} make an account (emails them)`"
                :disabled="busyId === e.id"
                class="px-3 py-1.5 text-sm rounded-md bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
                @click="approve(e)"
              >Approve</button>
              <button
                :title="`Turn down ${e.email} (sends nothing)`"
                :disabled="busyId === e.id"
                class="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-brand-700 hover:bg-gray-50 dark:hover:bg-brand-800 disabled:opacity-50"
                @click="deny(e)"
              >Deny</button>
            </div>
          </li>
        </ul>
      </section>
      <p v-else-if="data.mode === 'approval'" class="text-sm text-gray-500 dark:text-brand-400">
        Nobody is asking to join right now.
      </p>

      <!-- Invite -->
      <section aria-label="Let someone in" class="space-y-2">
        <h3 class="text-sm font-semibold">Let someone in</h3>
        <p class="text-xs text-gray-500 dark:text-brand-400">
          They can make an account the next time they sign in with this email. No email is sent.
        </p>
        <form class="flex gap-2" data-testid="invite-form" @submit.prevent="inviteEmail">
          <label for="invite-email" class="sr-only">Email to let in</label>
          <input
            id="invite-email"
            v-model="newEmail"
            type="email"
            required
            maxlength="254"
            placeholder="friend@example.com"
            class="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-300 dark:border-brand-700 rounded-md bg-white dark:bg-brand-800"
          />
          <button
            type="submit"
            title="Add this email to the list"
            :disabled="inviting"
            class="px-3 py-1.5 text-sm rounded-md bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
          >Add</button>
        </form>
        <ul v-if="invited.length" class="divide-y divide-gray-100 dark:divide-brand-800">
          <li v-for="e in invited" :key="e.id" class="py-1.5 flex items-center gap-2 text-sm" data-testid="invited-entry">
            <span class="flex-1 min-w-0 break-all">{{ e.email }}</span>
            <span class="text-xs text-gray-500 dark:text-brand-400 hidden sm:inline">hasn't signed in yet</span>
            <button
              :title="`Remove ${e.email} from the list`"
              :disabled="busyId === e.id"
              class="text-gray-500 hover:text-red-600 p-1"
              @click="remove(e)"
            ><i class="mdi mdi-close" aria-hidden="true"></i><span class="sr-only">Remove</span></button>
          </li>
        </ul>
      </section>

      <!-- Denied -->
      <details v-if="denied.length" class="text-sm">
        <summary class="cursor-pointer text-gray-600 dark:text-brand-300">Denied ({{ denied.length }})</summary>
        <ul class="mt-1 divide-y divide-gray-100 dark:divide-brand-800">
          <li v-for="e in denied" :key="e.id" class="py-1.5 flex items-center gap-2" data-testid="denied-entry">
            <span class="flex-1 min-w-0 break-all">{{ e.email }}</span>
            <button
              :title="`Let ${e.email} make an account after all (emails them)`"
              :disabled="busyId === e.id"
              class="text-xs text-brand-600 dark:text-brand-300 hover:underline"
              @click="approve(e)"
            >Approve</button>
            <button
              :title="`Remove ${e.email}, so they can ask again`"
              :disabled="busyId === e.id"
              class="text-gray-500 hover:text-red-600 p-1"
              @click="remove(e)"
            ><i class="mdi mdi-close" aria-hidden="true"></i><span class="sr-only">Remove</span></button>
          </li>
        </ul>
      </details>
    </template>
  </article>
</template>
