import { request } from "@/lib/httpClient";

export const tagsApi = {
  list: async () => {
    const response = await request("/api/tags.php");
    return response.tags;
  },
  create: async (payload) => {
    const response = await request("/api/tags.php", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.tag;
  },
  remove: async (id) => request(`/api/tags.php?id=${id}`, { method: "DELETE" }),
};
