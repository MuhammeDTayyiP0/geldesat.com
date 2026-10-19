import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Flame, Plus, Rocket, Sparkles, Type, type LucideIcon } from 'lucide-react-native';
import { Button, Card, Header, Text, radius, space, useTheme } from '@/ui';

/** Packages as described on the website (web/src/lib/data/geo.ts); sales are closed for now. */
const PACKAGES: { name: string; blurb: string; icon: LucideIcon }[] = [
  { name: 'Vitrin', blurb: 'Ana sayfa vitrininde 7 gün', icon: Sparkles },
  { name: 'Acil Acil', blurb: 'Listelerde öne çıkan acil rozeti, 3 gün', icon: Flame },
  { name: 'Kalın Başlık', blurb: 'Arama sonuçlarında kalın yazı, 7 gün', icon: Type },
];

export default function DopingScreen() {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Doping" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.hero, { backgroundColor: c.primarySoft }]}>
          <Rocket size={32} color={c.primary} />
          <Text variant="heading" center>
            İlanınızı öne çıkarın
          </Text>
          <Text tone="muted" center>
            Doping ve kredi satışı şu an kapalı. İlan vermek ücretsizdir; satış açıldığında buradan doping alabileceksiniz.
          </Text>
        </View>
        {PACKAGES.map((p) => (
          <Card key={p.name} style={styles.pkg}>
            <View style={[styles.icon, { backgroundColor: c.elevated }]}>
              <p.icon size={22} color={c.primary} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{p.name}</Text>
              <Text variant="caption" tone="muted">
                {p.blurb}
              </Text>
            </View>
            <Text variant="label" tone="subtle">
              Yakında
            </Text>
          </Card>
        ))}
        <Button title="Ücretsiz ilan ver" icon={Plus} onPress={() => router.push('/ilan-ver')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  hero: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.lg, marginBottom: space.sm },
  pkg: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
