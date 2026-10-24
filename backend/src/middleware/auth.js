/**
 * Authentication middleware — checks session for user_id.
 */

import { errorResponse } from "../lib/helpers.js";

/**
 * Hono middleware: sets c.userId if authenticated, otherwise 401.
 */
export function requireAuth() {
  return async (c, next) => {
    const userId = c.session.get("user_id");
    if (!userId) {
      return errorResponse(c, "Authentication required", 401);
    }
    c.userId = userId;
    await next();
  };
}

/**
 * Hono middleware: sets c.userId if authenticated but does NOT block.
 * Useful for routes that are optionally authenticated.
 */
export function optionalAuth() {
  return async (c, next) => {
    c.userId = c.session.get("user_id") || null;
    await next();
  };
}
