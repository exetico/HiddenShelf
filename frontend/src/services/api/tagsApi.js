import { request, revalidated } from "@/lib/httpClient";

export const tagsApi = {
  list: async () => {
    const response = await revalidated("/api/tags");
    return response.tags;
  },
  create: async (payload) => {
    const response = await request("/api/tags", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.tag;
  },
  update: async (id, payload) => {
    const response = await request(`/api/tags?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.tag;
  },
  remove: async (id) => request(`/api/tags?id=${id}`, { method: "DELETE" }),
};
