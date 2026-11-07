import { useMemo, useSyncExternalStore } from "react";
import { authClient } from "./client";

const noSubscribe = () => () => {};

/**
 * False while React hydrates server HTML (it then uses the server snapshot),
 * true for every render after that, including lazily-hydrated routes.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/** Normalized user shape used across the app. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

/**
 * Current Better Auth user + loading state. Protect a route by waiting out
 * `isPending` before acting on `user` — redirecting on `user: null` alone
 * bounces signed-in visitors to sign-in on every hard reload:
 *
 *   const { user, isPending } = useCurrentUserState();
 *   if (isPending) return null;              // still resolving — don't redirect yet
 *   if (!user) return <RedirectToSignIn />;  // definitely signed out
 */
export function useCurrentUserState(): CurrentUserState {
  const { data, isPending } = authClient.useSession();
  // The session is refetched whenever the tab regains focus, with a new object
  // each time. Keeping `user` stable until a shown field really changes stops
  // every screen reloading and forms losing what was typed.
  const id = data?.user?.id;
  const displayName = data?.user?.name ?? null;
  const primaryEmail = data?.user?.email ?? null;
  const profileImageUrl = data?.user?.image ?? null;
  const user = useMemo<AppUser | null>(
    () => (id ? { id, displayName, primaryEmail, profileImageUrl } : null),
    [id, displayName, primaryEmail, profileImageUrl],
  );

  // The server always renders the "still loading" state, so the first client
  // render must too or hydration mismatches; the real state follows on mount.
  const hydrated = useHydrated();
  const pending = !hydrated || isPending;
  return useMemo(() => ({ user: hydrated ? user : null, isPending: pending }), [hydrated, user, pending]);
}

/**
 * Convenience view of `useCurrentUserState().user` for display. NOTE: `null`
 * means *loading OR signed out* — for redirects/guards use
 * `useCurrentUserState()` and check `isPending`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
