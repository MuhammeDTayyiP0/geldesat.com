export type SignInGateState = "pending" | "signed_in" | "signed_out";

export type SignInGateInput = {
  isPending: boolean;
  hasUser: boolean;
};

export function resolveSignInGateState(
  input: SignInGateInput,
): SignInGateState {
  if (input.isPending) return "pending";
  return input.hasUser ? "signed_in" : "signed_out";
}

/** Only same-site paths are honored, so the login page cannot redirect off-site. */
export function safeRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  // Browsers drop tabs and newlines and read "\\" as "/" before resolving a URL,
  // so "/<tab>/evil.com" would leave the site.
  const unsafe = value.includes("\\") || [...value].some((ch) => ch.charCodeAt(0) < 32);
  return unsafe ? "/" : value;
}
