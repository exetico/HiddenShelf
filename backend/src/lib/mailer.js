/**
 * Mailer service — sends magic link emails via SMTP (nodemailer).
 * In debug mode, logs the link to console instead.
 */

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

/**
 * Send a magic link email.
 * @param {string} email
 * @param {string} token
 * @param {string|null} redirectOrigin
 */
export async function sendMagicLink(email, token, redirectOrigin = null) {
  const magicLink = `${config.siteUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const subject = `Your login link for ${config.siteName}`;
  const text = [
    "Hello,",
    "",
    `Click the link below to log in to ${config.siteName}:`,
    "",
    magicLink,
    "",
    `This link will expire in ${Math.round(config.magicLinkExpiry / 60)} minutes.`,
    "",
    "If you didn't request this, you can safely ignore this email.",
    "",
    "---",
    config.siteName,
  ].join("\n");

  // In debug mode, log instead of sending
  if (config.debugMode) {
    let logMsg = `[mailer] Magic link for ${email}: ${magicLink}`;
    if (redirectOrigin) {
      logMsg += ` (will redirect to: ${redirectOrigin}/dashboard)`;
    }
    console.log(logMsg);
    return true;
  }

  const mail = getTransporter();
  await mail.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: email,
    subject,
    text,
  });

  return true;
}
