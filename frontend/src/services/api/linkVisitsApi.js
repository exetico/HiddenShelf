import { request } from "@/lib/httpClient";

export const linkVisitsApi = {
  /**
   * Get visit summary for all public links (or a specific link by id).
   * @param {object} [options]
   * @param {number} [options.linkId]   - filter to a single link
   * @param {number} [options.days=30]  - look-back window
   */
  getSummary: async ({ linkId, days = 30 } = {}) => {
    const params = new URLSearchParams({ days: String(days) });
    if (linkId) params.set("link_id", String(linkId));
    const response = await request(`/api/link_visits?${params.toString()}`);
    return response;
  },
};
