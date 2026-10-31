import { request, revalidated } from "@/lib/httpClient";

export const linksApi = {
  // The whole shelf: your links and those in categories shared with you,
  // hidden categories included. The app searches and filters it itself.
  // Sends the last answer's ETag, so an unchanged shelf comes back as a
  // 304 with no body.
  list: async () => revalidated("/api/links?include_shared=1&include_hidden=1"),
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
  trash: async () => request("/api/links?trash=1"),
  restore: async (id) =>
    request(`/api/links/restore?id=${id}`, { method: "POST" }),
  deleteForever: async (id) =>
    request(`/api/links?id=${id}&permanent=1`, { method: "DELETE" }),
  emptyTrash: async () => request("/api/links/trash", { method: "DELETE" }),
};
