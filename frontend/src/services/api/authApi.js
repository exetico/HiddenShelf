import { request } from "@/lib/httpClient";

export const authApi = {
  me: async () => {
    const response = await request("/api/auth.php?action=me");
    return response.user;
  },
  logout: async () =>
    request("/api/auth.php?action=logout", { method: "POST" }),
};
