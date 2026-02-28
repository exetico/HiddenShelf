import { request } from "@/lib/httpClient";

export const settingsApi = {
  get: async () => {
    const response = await request("/api/user_settings.php");
    return response.settings;
  },
  update: async (payload) => {
    const response = await request("/api/user_settings.php", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.settings;
  },
};
