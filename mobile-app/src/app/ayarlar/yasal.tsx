import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileText, Info, Mail } from 'lucide-react-native';
import { Header, ListRow, RowGroup, space, useTheme } from '@/ui';

const CORPORATE = [
  { slug: 'hakkimizda', label: 'Hakkımızda', icon: Info },
  { slug: 'iletisim', label: 'İletişim', icon: Mail },
];

const LEGAL = [
  { slug: 'kullanim', label: 'Kullanım koşulları' },
  { slug: 'uyelik', label: 'Üyelik sözleşmesi' },
  { slug: 'kvkk', label: 'KVKK aydınlatma metni' },
  { slug: 'gizlilik', label: 'Gizlilik politikası' },
  { slug: 'cerez', label: 'Çerez politikası' },
];

export default function LegalIndex() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const router = useRouter();
  const open = (slug: string) => router.push({ pathname: '/sayfa/[slug]', params: { slug } });
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Yasal bilgiler" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]}>
        <RowGroup title="Kurumsal">
          {CORPORATE.map((p) => (
            <ListRow key={p.slug} icon={p.icon} label={p.label} onPress={() => open(p.slug)} />
          ))}
        </RowGroup>
        <RowGroup title="Sözleşmeler ve politikalar">
          {LEGAL.map((p) => (
            <ListRow key={p.slug} icon={FileText} label={p.label} onPress={() => open(p.slug)} />
          ))}
        </RowGroup>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.xl },
});
