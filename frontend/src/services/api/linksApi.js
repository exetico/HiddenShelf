import { request } from "@/lib/httpClient";

export const linksApi = {
  list: async ({
    page = 1,
    // How many the caller already has; wins over page when given
    offset = null,
    limit = 20,
    categoryId = "",
    search = "",
    tagId = "",
    // "category": View's order, pages end on a whole category
    group = "",
    // Also links in hidden categories
    includeHidden = false,
  } = {}) => {
    const params = new URLSearchParams();
    params.set("offset", String(offset ?? (page - 1) * limit));
    params.set("limit", String(limit));
    if (categoryId) params.set("category_id", String(categoryId));
    if (search) params.set("search", search);
    if (tagId) params.set("tag_id", String(tagId));
    if (group) params.set("group", group);
    if (includeHidden) params.set("include_hidden", "1");
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
  reorder: async (ids) =>
    request("/api/links/order", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    }),
  random: async () => {
    const response = await request("/api/links?random=1");
    return response.link;
  },
  // Moves the link to the trash
  remove: async (id) => request(`/api/links?id=${id}`, { method: "DELETE" }),
  favorites: async () => {
    const response = await request("/api/links?favorites=1");
    return response.links || [];
  },
  trash: async () => request("/api/links?trash=1"),
  restore: async (id) =>
    request(`/api/links/restore?id=${id}`, { method: "POST" }),
  deleteForever: async (id) =>
    request(`/api/links?id=${id}&permanent=1`, { method: "DELETE" }),
  emptyTrash: async () => request("/api/links/trash", { method: "DELETE" }),
};
