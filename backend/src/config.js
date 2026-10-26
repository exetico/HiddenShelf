/**
 * Configuration — loaded from environment variables with sensible defaults.
 * In Docker: env vars are set via docker-compose.yml.
 * Locally: set them before running, or they fall back to dev defaults.
 */

/**
 * BASE_PATH must look like "/shelf". Anything else (such as a comment that
 * a .env parser kept as the value) is ignored, with a warning.
 */
export function basePathFromEnv(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (/^\/[A-Za-z0-9._~\/-]*$/.test(trimmed)) return trimmed.replace(/\/$/, "");
  console.warn(
    `[config] Ignoring BASE_PATH=${JSON.stringify(value)}: it must be a path like /shelf, or empty.`,
  );
  return "";
}

// A value with " #" in it is most likely a comment the .env parser kept.
// Secrets are left out of the check; they may contain anything.
for (const [name, value] of Object.entries(process.env)) {
  if (
    /^(SITE_|BASE_PATH|SMTP_(HOST|PORT|USER|ENCRYPTION)|FROM_|DEBUG_MODE|SIGNUP_ENABLED|EMAIL_LOGIN_ENABLED|TRUST_PROXY|GOOGLE_(CLIENT_ID|REDIRECT_URI)|LINKS_PER_PAGE|MAGIC_LINK_EXPIRY|SESSION_)/.test(name) &&
    /(^|\s)#/.test(value)
  ) {
    console.warn(
      `[config] ${name}=${JSON.stringify(value)} looks like it includes a comment. Put comments in .env on their own line.`,
    );
  }
}

const config = {
  // Server
  port: parseInt(process.env.PORT || "3000", 10),

  // Database
  dbPath: process.env.DB_PATH || "./db/database.sqlite",

  // Site
  siteUrl: process.env.SITE_URL || "http://localhost:3000",
  basePath: basePathFromEnv(process.env.BASE_PATH),
  siteName: process.env.SITE_NAME || "Hidden Shelf",

  // Email / SMTP
  smtpHost: process.env.SMTP_HOST || "mail.smtpbucket.com",
  smtpPort: parseInt(process.env.SMTP_PORT || "8025", 10),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpEncryption: process.env.SMTP_ENCRYPTION || "", // 'tls' or 'ssl' or ''
  fromEmail: process.env.FROM_EMAIL || "noreply@example.com",
  fromName: process.env.FROM_NAME || "Hidden Shelf",
  // Optional DKIM signing, for SMTP servers that don't sign mail themselves.
  // The key is PEM text (\n for line breaks) or a file inside the container
  dkimDomain: process.env.DKIM_DOMAIN || "",
  dkimSelector: process.env.DKIM_SELECTOR || "",
  dkimPrivateKey: process.env.DKIM_PRIVATE_KEY || "",
  dkimPrivateKeyFile: process.env.DKIM_PRIVATE_KEY_FILE || "",

  // Magic link
  magicLinkExpiry: parseInt(
    process.env.MAGIC_LINK_EXPIRY || String(15 * 60),
    10,
  ), // seconds

  // Session
  sessionName: process.env.SESSION_NAME || "hiddenshelf_session",
  sessionLifetime: parseInt(
    process.env.SESSION_LIFETIME || String(30 * 24 * 60 * 60),
    10,
  ), // seconds

  // Pagination
  linksPerPage: parseInt(process.env.LINKS_PER_PAGE || "20", 10),

  // Reverse proxy: "true" always trusts X-Forwarded-For and friends, "false"
  // never does. Unset: trusted only when the request comes from a loopback
  // or private address, i.e. a proxy on the same host or Docker network.
  trustProxy: process.env.TRUST_PROXY || "auto",

  // Development
  debugMode: (process.env.DEBUG_MODE || "false") === "true",

  // Registration
  signupEnabled: (process.env.SIGNUP_ENABLED || "true") === "true",

  // Magic link login by email. Off: no email is ever sent (SMTP unused) and
  // Google sign-in is the only way to log in.
  emailLoginEnabled: (process.env.EMAIL_LOGIN_ENABLED || "true") === "true",

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.SITE_URL || "http://localhost:3000"}/api/auth/google/callback`,

  // App version
  appVersion: process.env.APP_VERSION || "2.0.0",
};

export default config;
