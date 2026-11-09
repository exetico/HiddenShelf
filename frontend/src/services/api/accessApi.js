import { request } from "@/lib/httpClient";

/**
 * Ask to join (when sign-up isn't open to everyone).
 * me/ask work on the email you just proved by signing in; admin* need an
 * admin (the server answers 404 to anyone else).
 */
export const accessApi = {
  /** { mode, email, status: "none"|"pending"|"approved"|"denied"|null, can_ask } */
  me: async () => request("/api/access/me"),
  ask: async (note) =>
    request("/api/access/request", { method: "POST", body: JSON.stringify({ note }) }),

  adminList: async () => request("/api/access/admin"),
  invite: async (email) =>
    request("/api/access/admin/invite", { method: "POST", body: JSON.stringify({ email }) }),
  approve: async (id) => request(`/api/access/admin/${id}/approve`, { method: "POST" }),
  deny: async (id) => request(`/api/access/admin/${id}/deny`, { method: "POST" }),
  remove: async (id) => request(`/api/access/admin/${id}`, { method: "DELETE" }),
};
