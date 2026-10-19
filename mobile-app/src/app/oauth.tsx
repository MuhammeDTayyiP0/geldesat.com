import { Redirect } from 'expo-router';

/**
 * geldesat://oauth?code=… is normally captured by the auth browser session
 * (see src/auth/auth.ts). If the system routes it here instead, go home.
 */
export default function OAuthReturn() {
  return <Redirect href="/" />;
}
