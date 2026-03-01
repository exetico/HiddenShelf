import { request } from "@/lib/httpClient";

export const accountApi = {
  deleteAllData: async () => {
    const response = await request("/api/account/data", {
      method: "DELETE",
    });
    return response;
  },
};
