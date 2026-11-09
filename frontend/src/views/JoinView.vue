<script setup>
/**
 * Ask to join. Someone new lands here after signing in (email link or
 * Google) on a server where sign-up isn't open to everyone. The server
 * remembers the email they proved for an hour; this page can only ask for
 * that email, never another one.
 */
import { ref, computed, onMounted } from "vue";
import { useReconnect } from "@/composables/useReconnect";
import { RouterLink } from "vue-router";
import { accessApi } from "@/services/api/accessApi";
import { useToastStore } from "@/stores/toast";
import { LIMITS } from "@/lib/limits";

const toast = useToastStore();

const info = ref(null);
const note = ref("");
const sending = ref(false);

const noteLeft = computed(() => LIMITS.joinNote - note.value.length);
// What to show: "signin", "ask", "pending", "approved", "denied" or "invite"
const state = computed(() => {
  const i = info.value;
  if (!i) return null;
  if (!i.email) return "signin";
  if (i.mode === "open" || i.status === "approved") return "approved";
  if (i.status === "pending") return "pending";
  if (i.status === "denied") return "denied";
  return i.can_ask ? "ask" : "invite";
});

async function load() {
  try {
    info.value = await accessApi.me();
  } catch {
    info.value = { email: null };
  }
}

async function send() {
  if (noteLeft.value < 0) return;
  sending.value = true;
  try {
    const res = await accessApi.ask(note.value.trim() || null);
    info.value = { ...info.value, status: res.status, can_ask: false };
  } catch (error) {
    if (error.status === 401) info.value = { ...info.value, email: null };
    else if (error.status === 429) toast.info(error.message);
    else toast.error(error.message || "Couldn't send your request");
  } finally {
    sending.value = false;
  }
}

onMounted(load);
// Ask again once the server is back, if it couldn't be reached
useReconnect(load);
</script>

<template>
  <div class="min-h-screen bg-brand-50 dark:bg-brand-950 flex flex-col items-center px-4 pt-10 sm:pt-16">
    <div class="max-w-md w-full space-y-6" data-testid="join-page">
      <div class="text-center">
        <i class="mdi mdi-bookshelf text-6xl text-brand-500" aria-hidden="true"></i>
        <h1 class="mt-4 text-2xl font-bold text-brand-900 dark:text-white">
          Ask to join Hidden Shelf
        </h1>
      </div>

      <div
        v-if="state"
        class="bg-white dark:bg-brand-900 py-8 px-6 shadow-lg rounded-lg space-y-4 text-brand-800 dark:text-brand-200"
        :data-state="state"
      >
        <template v-if="state === 'signin'">
          <p>To ask to join, sign in first with your email or Google. You'll come back here afterwards.</p>
        </template>

        <template v-else-if="state === 'ask'">
          <p>
            New accounts on this server need an admin's OK. You signed in as
            <strong class="break-all">{{ info.email }}</strong>.
          </p>
          <form class="space-y-3" @submit.prevent="send" data-testid="join-form">
            <label for="join-note" class="block text-sm font-medium">
              A note for the admin (optional)
            </label>
            <textarea
              id="join-note"
              v-model="note"
              rows="3"
              :maxlength="LIMITS.joinNote"
              placeholder="Who you are, or who sent you here"
              class="w-full px-3 py-2 border border-brand-300 dark:border-brand-700 rounded-lg bg-white dark:bg-brand-800 text-brand-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            ></textarea>
            <p v-if="noteLeft < 100" class="text-xs text-brand-500">
              {{ noteLeft }} characters left
            </p>
            <button
              type="submit"
              title="Send your request to the admins"
              :disabled="sending || noteLeft < 0"
              class="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg disabled:opacity-50"
            >
              <i v-if="sending" class="mdi mdi-loading mdi-spin" aria-hidden="true"></i>
              Ask to join
            </button>
          </form>
        </template>

        <template v-else-if="state === 'pending'">
          <p class="flex items-start gap-2">
            <i class="mdi mdi-clock-outline text-xl text-brand-500" aria-hidden="true"></i>
            <span>
              Your request is with the admins. When they let you in, you'll get an
              email at <strong class="break-all">{{ info.email }}</strong>, and you
              can sign in as usual.
            </span>
          </p>
        </template>

        <template v-else-if="state === 'approved'">
          <p>You're in. Sign in again to start using Hidden Shelf.</p>
        </template>

        <template v-else-if="state === 'denied'">
          <p>An admin didn't approve this request, so this server can't make an account for you.</p>
        </template>

        <template v-else>
          <p>
            This server only takes people an admin has invited, and
            <strong class="break-all">{{ info.email }}</strong> isn't on the list.
            If you know the admin, ask them to add you.
          </p>
        </template>

        <RouterLink
          to="/login"
          title="Go to the sign-in page"
          class="inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-300 hover:underline"
          data-testid="join-sign-in"
        >
          <i class="mdi mdi-arrow-left" aria-hidden="true"></i>
          {{ state === "signin" || state === "approved" ? "Sign in" : "Back to sign-in" }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
