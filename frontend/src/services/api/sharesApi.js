import { request } from "@/lib/httpClient";

export const sharesApi = {
  listSharedCategories: async () => {
    const response = await request("/api/category_shares");
    return response.shared_categories || [];
  },
  listOwnedShares: async () => {
    const response = await request("/api/category_shares?owned=1");
    return response.owned_shares || [];
  },
  getCategoryShare: async (categoryId) => {
    const response = await request(
      `/api/category_shares?category_id=${categoryId}`,
    );
    return response;
  },
  createCategoryShare: async (categoryId) => {
    const response = await request("/api/category_shares", {
      method: "POST",
      body: JSON.stringify({ category_id: categoryId }),
    });
    return response.share;
  },
  verifyShareCode: async (code) => {
    const response = await request(
      `/api/category_shares?code=${encodeURIComponent(code)}`,
    );
    return response.share;
  },
  acceptShare: async (shareCode) =>
    request("/api/category_shares", {
      method: "POST",
      body: JSON.stringify({ share_code: shareCode }),
    }),
  leaveSharedCategory: async (categoryId) =>
    request(`/api/category_shares?category_id=${categoryId}&leave=1`, {
      method: "DELETE",
    }),
  removeMember: async (categoryId, memberId) =>
    request(
      `/api/category_shares?category_id=${categoryId}&member_id=${memberId}`,
      { method: "DELETE" },
    ),
  removeSharing: async (categoryId) =>
    request(`/api/category_shares?category_id=${categoryId}`, {
      method: "DELETE",
    }),
};
