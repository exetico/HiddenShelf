import { request } from "@/lib/httpClient";

export const sharesApi = {
  listSharedCategories: async () => {
    const response = await request("/api/category_shares.php");
    return response.shared_categories || [];
  },
  getCategoryShare: async (categoryId) => {
    const response = await request(
      `/api/category_shares.php?category_id=${categoryId}`,
    );
    return response;
  },
  createCategoryShare: async (categoryId) => {
    const response = await request("/api/category_shares.php", {
      method: "POST",
      body: JSON.stringify({ category_id: categoryId }),
    });
    return response.share;
  },
  acceptShare: async (shareCode) =>
    request("/api/category_shares.php", {
      method: "POST",
      body: JSON.stringify({ share_code: shareCode }),
    }),
  leaveSharedCategory: async (categoryId) =>
    request(`/api/category_shares.php?category_id=${categoryId}&leave=1`, {
      method: "DELETE",
    }),
};
