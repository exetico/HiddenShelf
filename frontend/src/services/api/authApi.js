import { request } from "@/lib/httpClient";

export const authApi = {
  me: async () => {
    const response = await request("/api/auth.php?action=me");
    return response.user;
  },
  logout: async () =>
    request("/api/auth.php?action=logout", { method: "POST" }),
  sendMagicLink: async (email) => {
    const body = { email };

    // In dev mode (Vite dev server), send current origin so magic link redirects back here
    // In prod, don't send origin - let backend use SITE_URL
    if (import.meta.env.DEV) {
      body.redirect_origin = window.location.origin;
    }

    return request("/api/auth.php?action=login", {
      method: "POST",
      body,
    });
  },
  verify: async (token) =>
    request(`/api/auth.php?action=verify&token=${encodeURIComponent(token)}`),
};
