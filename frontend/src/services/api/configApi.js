import { request } from "@/lib/httpClient";

export const configApi = {
  get: async () => {
    const response = await request("/api/config.php");
    return response;
  },
};
