import { request } from "@/lib/httpClient";

export const categoriesApi = {
  list: async () => {
    const response = await request("/api/categories.php");
    return response.categories;
  },
  create: async (payload) => {
    const response = await request("/api/categories.php", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.category;
  },
  update: async (id, payload) => {
    const response = await request(`/api/categories.php?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.category;
  },
  remove: async (id) =>
    request(`/api/categories.php?id=${id}`, { method: "DELETE" }),
};
