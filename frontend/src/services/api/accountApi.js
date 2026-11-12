import { request } from "@/lib/httpClient";

export const accountApi = {
  deleteAllData: async () => {
    const response = await request("/api/account/data", {
      method: "DELETE",
    });
    return response;
  },
  // How many other devices are signed in to this account
  otherSessions: async () => {
    const response = await request("/api/account/sessions");
    return response.other_sessions ?? 0;
  },
  // Sign out every other device; this one stays signed in
  signOutOtherDevices: async () => {
    const response = await request("/api/account/sessions", { method: "DELETE" });
    return response.signed_out ?? 0;
  },
  // Delete the account itself. The server wants the account's email again.
  deleteAccount: async (email) =>
    request("/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};
