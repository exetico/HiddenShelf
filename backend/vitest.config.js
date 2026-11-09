import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    env: {
      // Enable debug mode so the mailer logs magic links instead of sending
      // real emails — keeps tests hermetic and avoids SMTP failures.
      DEBUG_MODE: "true",
      NODE_ENV: "test",
      // Most tests sign in brand-new users; access.test.js covers the
      // other modes and the real default (invite)
      SIGNUP_MODE: "open",
    },
  },
});
