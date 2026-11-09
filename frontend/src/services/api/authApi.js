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
  /** returnTo: an app route ("#/admin") to land on after following the link */
  sendMagicLink: async (email, { returnTo } = {}) => {
    const body = { email };
    if (returnTo) body.return_to = returnTo;

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
  /** Google's sign-in page; returnTo is where the app lands afterwards. */
  googleSignInUrl: async ({ returnTo } = {}) => {
    const params = new URLSearchParams();
    // In dev mode, send redirect_origin so the callback comes back to the dev server
    if (import.meta.env.DEV) params.set("redirect_origin", window.location.origin);
    if (returnTo) params.set("return_to", returnTo);
    const query = params.toString();
    const res = await request(`/api/auth/google${query ? `?${query}` : ""}`);
    return res.authUrl;
  },
  verify: async (token) =>
    request(`/api/auth/verify?token=${encodeURIComponent(token)}`),
};
