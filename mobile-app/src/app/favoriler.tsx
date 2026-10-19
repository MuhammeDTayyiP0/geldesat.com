import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, LayoutGrid, List } from 'lucide-react-native';
import { useSession } from '@/auth/session';
import { useFavorites } from '@/features/listing/favorites';
import { ListingGrid } from '@/features/listing/ListingGrid';
import { Button, EmptyState, ErrorState, Header, IconButton, useTheme } from '@/ui';

export default function FavoritesScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const session = useSession();
  const favorites = useFavorites();
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header
        title="Favorilerim"
        subtitle={favorites.data ? `${favorites.data.length} ilan` : undefined}
        right={
          <IconButton
            icon={layout === 'grid' ? List : LayoutGrid}
            label="Görünümü değiştir"
            onPress={() => setLayout((l) => (l === 'grid' ? 'list' : 'grid'))}
          />
        }
      />
      {session.status !== 'signedIn' ? (
        <EmptyState
          icon={Heart}
          title="Favorileriniz burada"
          message="Beğendiğiniz ilanları kaydetmek ve her cihazda görmek için giriş yapın."
          action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />}
        />
      ) : favorites.isError ? (
        <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />
      ) : (
        <ListingGrid
          listings={favorites.data ?? []}
          layout={layout}
          loading={favorites.isLoading}
          refreshing={favorites.isRefetching}
          onRefresh={() => void favorites.refetch()}
          header={<View style={{ height: 12 }} />}
          empty={
            <EmptyState
              icon={Heart}
              title="Henüz favoriniz yok"
              message="İlanlardaki kalp simgesine dokunarak favorilerinize ekleyebilirsiniz. Fiyat düşünce haberdar olursunuz."
              action={<Button title="İlanlara göz at" variant="outline" onPress={() => router.navigate('/')} />}
            />
          }
        />
      )}
    </View>
  );
}
