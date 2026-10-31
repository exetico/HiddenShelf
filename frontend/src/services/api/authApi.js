import { request } from "@/lib/httpClient";

export const authApi = {
  /** The signed-in user, and "new"/"back" right after a login (else null) */
  me: async () => {
    const response = await request("/api/auth/me");
    return {
      user: response.user,
      welcome: response.welcome || null,
      // Listed in UPDATE_ADMIN_EMAILS on the server
      canUpdate: response.can_update === true,
    };
  },
  logout: async () => request("/api/auth/logout", { method: "POST" }),
  sendMagicLink: async (email) => {
    const body = { email };

    // In dev mode (Vite dev server), send current origin so magic link redirects back here
    // In prod, don't send origin - let backend use SITE_URL
    if (import.meta.env.DEV) {
      body.redirect_origin = window.location.origin;
    }

    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  verify: async (token) =>
    request(`/api/auth/verify?token=${encodeURIComponent(token)}`),
};
