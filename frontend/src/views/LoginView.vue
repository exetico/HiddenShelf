<script setup>
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { authApi } from "@/services/api/authApi";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const toastStore = useToastStore();

const email = ref("");
const loading = ref(false);
const sent = ref(false);
const rememberedEmail = ref(null);

onMounted(() => {
  // Check if already authenticated
  if (authStore.isAuthenticated) {
    const returnTo = sessionStorage.getItem("hiddenshelf_return_to") || "/";
    sessionStorage.removeItem("hiddenshelf_return_to");
    router.replace(returnTo);
    return;
  }

  // Check for OAuth errors in URL
  const errorParam = route.query.error;
  if (errorParam) {
    const errorMessages = {
      oauth_not_configured: "Google OAuth is not configured on the server.",
      oauth_denied: "You denied access to Google. Please try again.",
      invalid_state: "Security check failed. Please try logging in again.",
      oauth_failed: "Google login failed. Please try again or use email login.",
      signup_disabled:
        "New user registration is disabled. Please contact an administrator.",
    };
    toastStore.error(errorMessages[errorParam] || errorParam);
  }

  // Remember email from localStorage
  const saved = localStorage.getItem("hiddenshelf_email");
  if (saved) {
    rememberedEmail.value = saved;
    email.value = saved;
  }

  // Check for token verification in URL
  const token = route.query.token;
  if (token) {
    verifyToken(token);
  }
});

async function verifyToken(token) {
  try {
    loading.value = true;
    await authApi.verify(token);
    await authStore.bootstrap();

    const returnTo = sessionStorage.getItem("hiddenshelf_return_to") || "/";
    sessionStorage.removeItem("hiddenshelf_return_to");
    router.replace(returnTo);
  } catch (error) {
    toastStore.error("Invalid or expired login link");
  } finally {
    loading.value = false;
  }
}

async function sendMagicLink() {
  if (!email.value || !email.value.includes("@")) {
    toastStore.error("Please enter a valid email address");
    return;
  }

  try {
    loading.value = true;
    await authApi.sendMagicLink(email.value);
    localStorage.setItem("hiddenshelf_email", email.value);
    sent.value = true;
    toastStore.success("Magic link sent! Check your email.");
  } catch (error) {
    toastStore.error(error.message || "Failed to send magic link");
  } finally {
    loading.value = false;
  }
}

async function loginWithGoogle() {
  try {
    loading.value = true;

    // In dev mode, send redirect_origin so OAuth callback can redirect back to dev server
    const url = import.meta.env.DEV
      ? `/api/auth/google.php?redirect_origin=${encodeURIComponent(window.location.origin)}`
      : "/api/auth/google.php";

    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.authUrl) {
      window.location.href = data.authUrl;
    } else {
      toastStore.error(data.error || "Failed to initiate Google login");
      loading.value = false;
    }
  } catch (error) {
    toastStore.error("Network error. Please try again.");
    loading.value = false;
  }
}

function useRememberedEmail() {
  email.value = rememberedEmail.value;
}

function clearRememberedEmail() {
  localStorage.removeItem("hiddenshelf_email");
  rememberedEmail.value = null;
  email.value = "";
}
</script>

<template>
  <div
    class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4"
  >
    <div class="max-w-md w-full space-y-8">
      <!-- Logo/Header -->
      <div class="text-center">
        <i class="mdi mdi-link-variant text-6xl text-brand-500"></i>
        <h2 class="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
          Hidden Shelf
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Sign in with your email
        </p>
      </div>

      <!-- Login Form -->
      <div
        v-if="!sent"
        class="bg-white dark:bg-gray-800 py-8 px-6 shadow-lg rounded-lg"
      >
        <!-- Remembered Email -->
        <div
          v-if="rememberedEmail && email !== rememberedEmail"
          class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <p class="text-sm text-blue-700 dark:text-blue-300 mb-2">
            Welcome back!
          </p>
          <div class="flex gap-2">
            <button
              @click="useRememberedEmail"
              class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Continue as {{ rememberedEmail }}
            </button>
            <span class="text-gray-400">·</span>
            <button
              @click="clearRememberedEmail"
              class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Use different email
            </button>
          </div>
        </div>

        <!-- Welcome back flow -->
        <div
          v-if="rememberedEmail && email === rememberedEmail && !sent"
          class="space-y-3 mb-4"
        >
          <button
            @click="sendMagicLink"
            :disabled="loading"
            class="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg focus:ring-4 focus:ring-brand-300 dark:focus:ring-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <i v-if="loading" class="mdi mdi-loading mdi-spin"></i>
            <span>{{ loading ? "Sending..." : "Send magic link" }}</span>
          </button>

          <!-- Divider -->
          <div class="relative my-3">
            <div class="absolute inset-0 flex items-center">
              <div
                class="w-full border-t border-gray-300 dark:border-gray-600"
              ></div>
            </div>
            <div class="relative flex justify-center text-xs">
              <span
                class="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400"
              >
                or
              </span>
            </div>
          </div>

          <!-- Google OAuth in remembered email flow -->
          <button
            @click="loginWithGoogle"
            :disabled="loading"
            class="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          <button
            @click="clearRememberedEmail"
            class="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-2"
          >
            Use a different email
          </button>
        </div>

        <form
          @submit.prevent="sendMagicLink"
          class="space-y-4"
          v-if="(!rememberedEmail || email !== rememberedEmail) && !sent"
        >
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Email address
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              :disabled="loading"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg focus:ring-4 focus:ring-brand-300 dark:focus:ring-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <i v-if="loading" class="mdi mdi-loading mdi-spin"></i>
            <span>{{ loading ? "Sending..." : "Send magic link" }}</span>
          </button>
        </form>

        <!-- Divider -->
        <div
          v-if="(!rememberedEmail || email !== rememberedEmail) && !sent"
          class="relative my-6"
        >
          <div class="absolute inset-0 flex items-center">
            <div
              class="w-full border-t border-gray-300 dark:border-gray-600"
            ></div>
          </div>
          <div class="relative flex justify-center text-xs">
            <span
              class="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            >
              or
            </span>
          </div>
        </div>

        <!-- Google OAuth Button -->
        <button
          v-if="(!rememberedEmail || email !== rememberedEmail) && !sent"
          @click="loginWithGoogle"
          :disabled="loading"
          class="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>Sign in with Google</span>
        </button>

        <!-- Beta Warning -->
        <div
          class="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
        >
          <p class="text-xs text-yellow-700 dark:text-yellow-300">
            <strong>Beta Service:</strong> Data may be deleted without notice.
            Don't store critical information.
          </p>
        </div>
      </div>

      <!-- Success State -->
      <div
        v-else
        class="bg-white dark:bg-gray-800 py-8 px-6 shadow-lg rounded-lg text-center"
      >
        <i class="mdi mdi-email-check text-5xl text-green-500 mb-4"></i>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Check your email
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          We sent a magic link to <strong>{{ email }}</strong>
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-500">
          Click the link in the email to sign in. The link expires in 15
          minutes.
        </p>
        <button
          @click="sent = false"
          class="mt-6 text-brand-500 hover:text-brand-600 font-medium text-sm"
        >
          Send to different email
        </button>
      </div>
    </div>
  </div>
</template>
