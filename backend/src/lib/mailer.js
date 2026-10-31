/**
 * Mailer service — sends magic link emails via SMTP (nodemailer).
 * In debug mode, logs the link to console instead.
 *
 * The login email is built to get past spam filters:
 * - plain text and HTML versions with the same words (multipart/alternative)
 * - no images, scripts, forms, web fonts or tracking; styles are inline
 * - the button and the written-out link are the same URL on SITE_URL, so
 *   nothing looks like a disguised link
 * - From is a plain address on your domain and Message-ID uses that domain
 * - Auto-Submitted marks it as automatic, so out-of-office replies skip it
 * The rest (SPF, DKIM, DMARC) is up to the SMTP provider and its DNS setup.
 */

import crypto from "node:crypto";
import nodemailer from "nodemailer";
import config from "../config.js";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const opts = {
    host: config.smtpHost,
    port: config.smtpPort,
  };

  if (config.smtpUser && config.smtpPass) {
    opts.auth = { user: config.smtpUser, pass: config.smtpPass };
  }

  if (config.smtpEncryption === "tls") {
    opts.secure = false;
    opts.requireTLS = true;
  } else if (config.smtpEncryption === "ssl") {
    opts.secure = true;
  } else {
    opts.secure = false;
    opts.tls = { rejectUnauthorized: false };
  }

  transporter = nodemailer.createTransport(opts);
  return transporter;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function domainOf(address) {
  return String(address).split("@").pop().toLowerCase();
}

function expiryText(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

// Shared look; the brand green from the app's default theme
const COLORS = {
  page: "#f4f4f2",
  card: "#ffffff",
  border: "#e4e4e0",
  text: "#1f2420",
  muted: "#5f665d",
  brand: "#4f5749",
};
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * The login email's subject, plain text and HTML.
 * @param {{ email: string, link: string, expirySeconds: number }} opts
 */
export function buildMagicLinkEmail({ email, link, expirySeconds }) {
  const site = config.siteName;
  const host = new URL(config.siteUrl).host;
  const valid = expiryText(expirySeconds);

  const subject = `Sign in to ${site}`;

  const text = [
    `Sign in to ${site}`,
    "",
    `Someone (hopefully you) asked to sign in to ${site} as ${email}.`,
    "Open this link to sign in:",
    "",
    link,
    "",
    `The link works once and expires in ${valid}.`,
    "",
    "If you didn't ask for this, you can ignore this email. Nobody can sign",
    "in without the link, and your account stays as it is.",
    "",
    "--",
    `${site} (${host})`,
    "This is an automatic message, so replies are not read.",
  ].join("\n");

  const e = escapeHtml;
  const p = (style, content) =>
    `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${COLORS.text};${style}">${content}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLORS.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;">
<tr><td style="padding:32px 32px 8px;">
${p(`font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${COLORS.brand};`, e(site))}
<h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:600;color:${COLORS.text};">Sign in to ${e(site)}</h1>
${p("", `Someone (hopefully you) asked to sign in as <strong>${e(email)}</strong>. Use the button below to finish signing in.`)}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;">
<tr><td style="border-radius:8px;background-color:${COLORS.brand};">
<a href="${e(link)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Sign in to ${e(site)}</a>
</td></tr>
</table>
${p(`font-size:14px;color:${COLORS.muted};`, `The link works once and expires in ${e(valid)}. If the button doesn't work, copy this address into your browser:`)}
${p(`font-size:13px;word-break:break-all;`, `<a href="${e(link)}" style="color:${COLORS.brand};">${e(link)}</a>`)}
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid ${COLORS.border};">
${p(`margin:0;font-size:13px;color:${COLORS.muted};`, `If you didn't ask for this, you can ignore this email. Nobody can sign in without the link, and your account stays as it is.`)}
</td></tr>
</table>
${p(`margin:16px 0 0;font-size:12px;color:${COLORS.muted};text-align:center;`, `${e(site)} &middot; ${e(host)}<br>This is an automatic message, so replies are not read.`)}
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}

/** The full nodemailer message for a login email. */
export function magicLinkMessage(email, link) {
  const { subject, text, html } = buildMagicLinkEmail({
    email,
    link,
    expirySeconds: config.magicLinkExpiry,
  });
  return {
    // An object, so nodemailer quotes and encodes the name correctly
    from: { name: config.fromName, address: config.fromEmail },
    to: email,
    subject,
    text,
    html,
    // On the sender's own domain; filters dislike IDs from a bare hostname
    messageId: `<${crypto.randomUUID()}@${domainOf(config.fromEmail)}>`,
    headers: {
      // RFC 3834: sent by a program, so autoresponders don't answer it
      "Auto-Submitted": "auto-generated",
      // Exchange/Outlook equivalent
      "X-Auto-Response-Suppress": "All",
    },
  };
}

/**
 * Send a magic link email.
 * @param {string} email
 * @param {string} token
 * @param {string|null} redirectOrigin
 */
export async function sendMagicLink(email, token, redirectOrigin = null) {
  const magicLink = `${config.siteUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  // In debug mode, log instead of sending
  if (config.debugMode) {
    let logMsg = `[mailer] Magic link for ${email}: ${magicLink}`;
    if (redirectOrigin) {
      logMsg += ` (will redirect to: ${redirectOrigin}/dashboard)`;
    }
    console.log(logMsg);
    return true;
  }

  await getTransporter().sendMail(magicLinkMessage(email, magicLink));

  return true;
}

/**
 * Send a short plain-text notice (used for update notices to admins).
 * Skipped when email login is off, since SMTP may not be set up then.
 */
export async function sendNotice(to, subject, text) {
  if (config.debugMode || !config.emailLoginEnabled) {
    console.log(`[mailer] Notice to ${to}: ${subject}`);
    return false;
  }
  await getTransporter().sendMail({
    from: { name: config.fromName, address: config.fromEmail },
    to,
    subject,
    text,
    messageId: `<${crypto.randomUUID()}@${domainOf(config.fromEmail)}>`,
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
    },
  });
  return true;
}
