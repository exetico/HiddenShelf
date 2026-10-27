/**
 * Tests for the login email: its content and the headers that help it get
 * past spam filters. Messages are built with nodemailer's stream transport,
 * which produces the exact bytes an SMTP server would receive.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import config from "../src/config.js";
import { buildMagicLinkEmail, magicLinkMessage } from "../src/lib/mailer.js";

const LINK = "https://shelf.example.org/api/auth/verify?token=abc123";
const saved = { ...config };

async function raw(message, transportOptions = {}) {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
    ...transportOptions,
  });
  const info = await transport.sendMail(message);
  return info.message.toString();
}

describe("login email", () => {
  beforeEach(() => {
    Object.assign(config, {
      siteName: "Hidden Shelf",
      siteUrl: "https://shelf.example.org",
      fromEmail: "login@shelf.example.org",
      fromName: "Hidden Shelf",
      magicLinkExpiry: 900,
    });
  });
  afterEach(() => {
    Object.assign(config, saved);
  });

  it("has a plain subject and both a text and an HTML version", async () => {
    const { subject, text, html } = buildMagicLinkEmail({
      email: "dana@example.net",
      link: LINK,
      expirySeconds: 900,
    });
    expect(subject).toBe("Sign in to Hidden Shelf");
    for (const body of [text, html]) {
      expect(body).toContain("dana@example.net");
      expect(body).toContain("expires in 15 minutes");
      expect(body).toContain("If you didn't ask for this, you can ignore this email");
    }
    expect(text).toContain(`\n${LINK}\n`);

    const message = await raw(magicLinkMessage("dana@example.net", LINK));
    expect(message).toMatch(/^Content-Type: multipart\/alternative;/m);
    expect(message).toMatch(/^Content-Type: text\/plain; charset=utf-8/m);
    expect(message).toMatch(/^Content-Type: text\/html; charset=utf-8/m);
  });

  it("only links to the site, and every link shows its real address", () => {
    const { html } = buildMagicLinkEmail({ email: "a@b.c", link: LINK, expirySeconds: 900 });
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toBe(LINK);
    // The address is also written out, so the button hides nothing
    expect(html).toContain(`>${LINK}</a>`);
  });

  it("has nothing filters treat as suspicious", () => {
    const { subject, html } = buildMagicLinkEmail({ email: "a@b.c", link: LINK, expirySeconds: 900 });
    // No images, scripts, forms, remote CSS or tracking
    expect(html).not.toMatch(/<img|<script|<form|<iframe|<link\b|@import|url\(/i);
    expect(html).not.toMatch(/display:\s*none|font-size:\s*[01]px/i);
    // A real HTML document with a language and inline styles only
    expect(html).toMatch(/^<!DOCTYPE html>\n<html lang="en">/);
    expect(html).not.toContain("<style");
    // No shouting or spam words
    expect(subject).not.toMatch(/!|\$|free|urgent|act now|verify your account/i);
    expect(html).not.toMatch(/click here|!!|urgent/i);
  });

  it("escapes names and addresses in the HTML", () => {
    config.siteName = `<Shelf & "Co">`;
    const { html } = buildMagicLinkEmail({
      email: `"><img src=x>@example.net`,
      link: LINK,
      expirySeconds: 900,
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;Shelf &amp; &quot;Co&quot;&gt;");
  });

  it("says hours for longer expiries", () => {
    const { text } = buildMagicLinkEmail({ email: "a@b.c", link: LINK, expirySeconds: 3600 });
    expect(text).toContain("expires in 1 hour.");
  });

  it("sends with sender-domain headers and marks itself as automatic", async () => {
    config.fromName = 'Hidden "Shelf"';
    const message = await raw(magicLinkMessage("dana@example.net", LINK));
    const headers = message.split("\n\n")[0];
    expect(headers).toMatch(/^From: "Hidden \\"Shelf\\"" <login@shelf\.example\.org>$/m);
    expect(headers).toMatch(/^To: dana@example\.net$/m);
    expect(headers).toMatch(/^Subject: Sign in to Hidden Shelf$/m);
    expect(headers).toMatch(/^Message-ID: <[0-9a-f-]{36}@shelf\.example\.org>$/m);
    expect(headers).toMatch(/^Date: /m);
    expect(headers).toMatch(/^Auto-Submitted: auto-generated$/m);
    expect(headers).toMatch(/^X-Auto-Response-Suppress: All$/m);
    // Transactional, so no bulk-mail headers
    expect(headers).not.toMatch(/^(Precedence|List-Unsubscribe|X-Mailer):/im);
  });
});
