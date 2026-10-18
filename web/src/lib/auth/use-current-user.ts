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
  const rawUser = data?.user;
  const user = useMemo<AppUser | null>(() => {
    if (!rawUser) return null;
    return {
      id: rawUser.id,
      displayName: rawUser.name ?? null,
      primaryEmail: rawUser.email ?? null,
      profileImageUrl: rawUser.image ?? null,
    };
  }, [rawUser]);

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
