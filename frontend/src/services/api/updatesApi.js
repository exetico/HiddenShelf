import { request } from "@/lib/httpClient";

/** In-app updates; admins only (the server answers 404 to anyone else). */
export const updatesApi = {
  status: async () => request("/api/updates"),
  update: async (commit) =>
    request("/api/updates/update", {
      method: "POST",
      body: JSON.stringify({ commit }),
    }),
  rollback: async () =>
    request("/api/updates/rollback", { method: "POST", body: "{}" }),
};
