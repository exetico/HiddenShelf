/**
 * Public link routes — the short URLs people share.
 *
 * Endpoint mapping:
 *   GET /h/:hash                → redirect (direct-redirect links) or the link page
 *   GET /h/:hash?stay           → always the link page
 *   GET /public/view.html?hash= → old link page URL, redirects to /h/:hash
 *
 * The link page is the Vue build's link.html, served with the link's
 * title and description filled into the <title> and Open Graph tags, so
 * chat apps show a proper preview.
 */

import fs from "node:fs";
import { Hono } from "hono";
import { getDb } from "../lib/database.js";
import { baseUrl, withAbsoluteShareImage } from "../lib/helpers.js";
import { logVisit } from "./linkVisits.js";

const HASH_PATTERN = /^[a-zA-Z0-9]{1,20}$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Descriptions may use simple Markdown; previews want plain text */
export function stripMarkdown(text) {
  return String(text)
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|$)/g, "$1$2")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

/**
 * Fill the link's title and description into the page's head.
 * The template marks the values to replace with data-link-meta attributes.
 */
export function renderLinkPage(template, link) {
  const title = `${link.title} — Hidden Shelf`;
  const description =
    (link.description && stripMarkdown(link.description)) ||
    `View "${link.title}" shared via Hidden Shelf`;

  return withAbsoluteShareImage(template)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /(<meta [^>]*data-link-meta="title"[^>]*content=")[^"]*(")/g,
      `$1${escapeHtml(title)}$2`,
    )
    .replace(
      /(<meta [^>]*data-link-meta="description"[^>]*content=")[^"]*(")/g,
      `$1${escapeHtml(description)}$2`,
    );
}

/**
 * @param {object} options
 * @param {string} options.templatePath  path to the built link.html
 */
export function publicLinkRoutes({ templatePath }) {
  const routes = new Hono();
  let template = null;

  routes.get("/h/:hash", (c) => {
    const hash = c.req.param("hash");
    if (!HASH_PATTERN.test(hash)) {
      return c.text("Invalid link", 404);
    }
    const db = getDb();
    const link = db
      .prepare(
        "SELECT id, url, title, description, direct_redirect FROM links WHERE hash = ? AND is_public = 1 AND deleted_at IS NULL",
      )
      .get(hash);

    if (!link) {
      return c.text("Link not found", 404);
    }

    // Direct redirect: go straight to the URL. The page logs its own
    // visits, so only this path logs here.
    if (link.direct_redirect && c.req.query("stay") === undefined) {
      logVisit(db, link.id, c);
      return c.redirect(link.url, 302);
    }

    if (template === null) {
      try {
        template = fs.readFileSync(templatePath, "utf8");
      } catch {
        return c.text("The frontend is not built yet", 503);
      }
    }
    return c.html(renderLinkPage(template, link));
  });

  // Links shared before the page moved
  routes.get("/public/view.html", (c) => {
    const hash = c.req.query("hash") || "";
    if (!HASH_PATTERN.test(hash)) {
      return c.redirect(baseUrl("/"), 302);
    }
    const stay = c.req.query("stay") !== undefined ? "?stay" : "";
    return c.redirect(baseUrl(`/h/${hash}${stay}`), 301);
  });

  return routes;
}
