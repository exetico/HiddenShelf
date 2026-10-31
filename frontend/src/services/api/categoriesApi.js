import { request, revalidated } from "@/lib/httpClient";

export const categoriesApi = {
  list: async () => {
    const response = await revalidated("/api/categories");
    return response.categories;
  },
  create: async (payload) => {
    const response = await request("/api/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.category;
  },
  update: async (id, payload) => {
    const response = await request(`/api/categories?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.category;
  },
  reorder: async (ids) =>
    request("/api/categories/order", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    }),
  remove: async (id) =>
    request(`/api/categories?id=${id}`, { method: "DELETE" }),
};
