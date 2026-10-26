import { request } from "@/lib/httpClient";

export const linksApi = {
  list: async ({
    page = 1,
    limit = 20,
    categoryId = "",
    search = "",
    tagId = "",
  } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (categoryId) params.set("category_id", String(categoryId));
    if (search) params.set("search", search);
    if (tagId) params.set("tag_id", String(tagId));
    params.set("include_shared", "1");
    const response = await request(`/api/links?${params.toString()}`);
    return response;
  },
  create: async (payload) => {
    const response = await request("/api/links", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.link;
  },
  update: async (id, payload) => {
    const response = await request(`/api/links?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.link;
  },
  // Own links with the same URL (ignores http/https, www., trailing slash)
  findDuplicates: async (url, excludeId = null) => {
    const params = new URLSearchParams({ duplicate_of: url });
    if (excludeId) params.set("exclude_id", String(excludeId));
    const response = await request(`/api/links?${params.toString()}`);
    return response.matches || [];
  },
  remove: async (id) => request(`/api/links?id=${id}`, { method: "DELETE" }),
};
