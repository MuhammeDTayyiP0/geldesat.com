import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { Button, EmptyState, Header, useTheme } from '@/ui';

export default function NotFoundScreen() {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Sayfa bulunamadı" />
      <EmptyState
        icon={SearchX}
        title="Aradığınız sayfa bulunamadı"
        message="Bağlantı eskimiş veya sayfa kaldırılmış olabilir."
        action={<Button title="Ana sayfaya dön" onPress={() => router.replace('/')} />}
      />
    </View>
  );
}
