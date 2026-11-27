import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Loading } from '@/ui';

WebBrowser.maybeCompleteAuthSession();

/**
 * geldesat://oauth?code=… is normally captured by the auth browser session
 * (see src/auth/auth.ts). Wait briefly for an active exchange before bouncing home.
 */
export default function OAuthReturn() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return <Loading label="Giriş tamamlanıyor…" />;
  return <Redirect href="/" />;
}
