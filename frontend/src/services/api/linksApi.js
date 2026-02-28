import { request } from "@/lib/httpClient";

export const linksApi = {
  list: async ({ page = 1, limit = 20, categoryId = "", search = "" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (categoryId) params.set("category_id", String(categoryId));
    if (search) params.set("search", search);
    params.set("include_shared", "1");
    const response = await request(`/api/links.php?${params.toString()}`);
    return response;
  },
  create: async (payload) => {
    const response = await request("/api/links.php", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.link;
  },
  update: async (id, payload) => {
    const response = await request(`/api/links.php?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.link;
  },
  remove: async (id) =>
    request(`/api/links.php?id=${id}`, { method: "DELETE" }),
};
