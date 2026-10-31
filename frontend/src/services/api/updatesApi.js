import { request } from "@/lib/httpClient";

/** In-app updates; admins only (the server answers 404 to anyone else). */
export const updatesApi = {
  status: async () => request("/api/updates"),
  // No body: the server decides what to install
  update: async () => request("/api/updates/update", { method: "POST" }),
  rollback: async () => request("/api/updates/rollback", { method: "POST" }),
};
