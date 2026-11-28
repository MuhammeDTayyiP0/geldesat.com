import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Check, History, Image as ImageIcon, SearchX, Trash2 } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { listings } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import { PHOTO_QUALITY_LABELS, usePhotoQuality, type PhotoQuality } from '@/lib/mediaPref';
import { clearSearches } from '@/lib/storage';
import { confirm, Header, ListRow, RowGroup, Text, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

const QUALITY_OPTIONS: PhotoQuality[] = ['low', 'standard', 'high'];

export default function StorageSettingsScreen() {
  return (
    <RequireSignIn title="Veri ve depolama">
      <StorageSettings />
    </RequireSignIn>
  );
}

function StorageSettings() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [quality, setQuality] = usePhotoQuality();
  const [clearingRecent, setClearingRecent] = useState(false);

  const clearRecentListings = async () => {
    const ok = await confirm({
      title: 'Son baktıklarınız silinsin mi?',
      message: 'Hesabınızdaki son incelenen ilan geçmişi temizlenir.',
      confirmText: 'Temizle',
      destructive: true,
    });
    if (!ok) return;
    setClearingRecent(true);
    try {
      await listings.removeRecent(null);
      await queryClient.invalidateQueries({ queryKey: keys.recent });
      toast.success('Son baktığınız ilanlar temizlendi');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setClearingRecent(false);
    }
  };

  const clearRecentSearches = async () => {
    await clearSearches();
    toast.success('Arama geçmişi temizlendi');
  };

  const clearCache = async () => {
    queryClient.clear();
    toast.success('Uygulama önbelleği temizlendi');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Veri ve depolama" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
        <RowGroup title="Fotoğraf yükleme kalitesi">
          {QUALITY_OPTIONS.map((q) => (
            <ListRow
              key={q}
              icon={ImageIcon}
              label={PHOTO_QUALITY_LABELS[q].label}
              detail={PHOTO_QUALITY_LABELS[q].detail}
              checked={quality === q}
              right={quality === q ? <Check size={18} color={c.primary} /> : <View style={styles.spacer} />}
              onPress={() => {
                setQuality(q);
                toast.success('Fotoğraf kalitesi güncellendi');
              }}
            />
          ))}
        </RowGroup>

        <RowGroup title="Geçmiş ve önbellek">
          <ListRow
            icon={History}
            label="Son baktıklarımı temizle"
            detail="Son incelediğiniz 50 ilan geçmişini siler"
            disabled={clearingRecent}
            onPress={() => void clearRecentListings()}
          />
          <ListRow
            icon={SearchX}
            label="Arama geçmişini temizle"
            detail="Bu cihazdaki son arama terimlerini siler"
            onPress={() => void clearRecentSearches()}
          />
          <ListRow
            icon={Trash2}
            label="Uygulama önbelleğini temizle"
            detail="Geçici verileri sıfırlar ve listeleri yeniden yükler"
            onPress={() => void clearCache()}
          />
        </RowGroup>

        <Text variant="caption" tone="subtle">
          Fotoğraf kalitesi seçimi yalnızca bu cihazdaki yeni ilan yüklemeleri için geçerlidir.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  spacer: { width: 18 },
});
