import { request } from "@/lib/httpClient";

export const tagsApi = {
  list: async () => {
    const response = await request("/api/tags");
    return response.tags;
  },
  create: async (payload) => {
    const response = await request("/api/tags", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.tag;
  },
  remove: async (id) => request(`/api/tags?id=${id}`, { method: "DELETE" }),
};
