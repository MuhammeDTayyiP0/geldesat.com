import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "./use-current-user";

/**
 * Auth state components — plain wrappers around `useCurrentUserState()`.
 * While the session is still resolving, gates that care about signed-out state
 * render nothing so there's no signed-out flash on hard reload.
 */

/** Where `RedirectToSignIn` sends signed-out visitors. */
export const SIGN_IN_PATH = "/login";

/** Render children only when a user is signed in. */
export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

/**
 * Render children only once we KNOW the visitor is signed out (`isPending` has
 * cleared and there is no user). Hidden while the session is still loading.
 */
export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

/**
 * Client-side redirect to the sign-in route. The current path is passed as
 * `redirect` so the login page can send the visitor back afterwards.
 */
export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  const redirect =
    typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : undefined;
  return <Navigate to={to} search={redirect && redirect !== to ? { redirect } : {}} />;
}
