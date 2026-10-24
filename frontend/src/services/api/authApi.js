import { request } from "@/lib/httpClient";

export const authApi = {
  me: async () => {
    const response = await request("/api/auth/me");
    return response.user;
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
