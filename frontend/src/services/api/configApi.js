import { request } from "@/lib/httpClient";

export const configApi = {
  get: async () => {
    const response = await request("/api/config");
    return response;
  },
};
