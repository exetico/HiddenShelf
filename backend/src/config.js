/**
 * Configuration — loaded from environment variables with sensible defaults.
 * In Docker: env vars are set via docker-compose.yml.
 * Locally: set them before running, or they fall back to dev defaults.
 */

const config = {
  // Server
  port: parseInt(process.env.PORT || "3000", 10),

  // Database
  dbPath: process.env.DB_PATH || "./db/database.sqlite",

  // Site
  siteUrl: process.env.SITE_URL || "http://localhost:3000",
  basePath: process.env.BASE_PATH || "",
  siteName: process.env.SITE_NAME || "Hidden Shelf",

  // Email / SMTP
  smtpHost: process.env.SMTP_HOST || "mail.smtpbucket.com",
  smtpPort: parseInt(process.env.SMTP_PORT || "8025", 10),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpEncryption: process.env.SMTP_ENCRYPTION || "", // 'tls' or 'ssl' or ''
  fromEmail: process.env.FROM_EMAIL || "noreply@example.com",
  fromName: process.env.FROM_NAME || "Hidden Shelf",

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
  sessionSecret: process.env.SESSION_SECRET || "change-me-in-production-please",

  // Pagination
  linksPerPage: parseInt(process.env.LINKS_PER_PAGE || "20", 10),

  // Development
  debugMode: (process.env.DEBUG_MODE || "false") === "true",

  // Registration
  signupEnabled: (process.env.SIGNUP_ENABLED || "true") === "true",

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "",

  // App version
  appVersion: process.env.APP_VERSION || "2.0.0",
};

export default config;
