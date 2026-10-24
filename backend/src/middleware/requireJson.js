/**
 * CSRF guard — state-changing API requests that carry a body must send it
 * as JSON.
 *
 * A plain HTML form or a "simple" cross-site fetch can only send
 * text/plain, form-urlencoded or multipart bodies without a CORS preflight,
 * and the preflight is refused for other origins. Requiring
 * application/json therefore stops other sites from creating or changing
 * data with a user's session cookie (SameSite=Lax alone doesn't cover
 * sibling subdomains).
 */

import { errorResponse } from "../lib/helpers.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireJsonBody() {
  return async (c, next) => {
    if (WRITE_METHODS.has(c.req.method)) {
      const length = c.req.header("content-length");
      const hasBody =
        (length !== undefined && length !== "0") ||
        c.req.header("transfer-encoding") !== undefined;
      const type = c.req.header("content-type") || "";

      if (hasBody && !type.toLowerCase().startsWith("application/json")) {
        return errorResponse(c, "Content-Type must be application/json", 415);
      }
    }
    await next();
  };
}
