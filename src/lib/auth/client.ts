import { createAuthClient } from "better-auth/react";

/** Same-origin email/password sessions, stored in the site's own secure cookie. */
export const authClient = createAuthClient({
  fetchOptions: { credentials: "include" },
});

export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";
export const googleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";

export async function signOut(redirectTo = "/"): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? "Çıkış yapılamadı");
  if (typeof window !== "undefined") window.location.href = redirectTo;
}
