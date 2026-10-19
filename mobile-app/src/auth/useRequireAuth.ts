import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { getSession } from './session';

/**
 * Guard for actions that need an account (favorite, message, post):
 * returns true when signed in, otherwise opens the sign-in screen.
 */
export function useRequireAuth() {
  const router = useRouter();
  return useCallback(
    (reason?: string) => {
      if (getSession().status === 'signedIn') return true;
      router.push({ pathname: '/giris', params: reason ? { reason } : {} });
      return false;
    },
    [router],
  );
}
