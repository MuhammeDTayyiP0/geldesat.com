import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { Button, EmptyState, Header, Loading, useTheme } from '@/ui';
import { useSession } from './session';

/** Account screens: without a session they ask to sign in instead of loading forever. */
export function RequireSignIn({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme();
  const router = useRouter();
  const session = useSession();
  if (session.status === 'signedIn') return children;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={title} />
      {session.status === 'loading' ? (
        <Loading />
      ) : (
        <EmptyState
          icon={UserRound}
          title="Giriş yapın"
          message="Bu ayar hesabınıza bağlı. Görmek için giriş yapın."
          action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />}
        />
      )}
    </View>
  );
}
