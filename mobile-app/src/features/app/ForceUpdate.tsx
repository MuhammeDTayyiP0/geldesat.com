import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Download } from 'lucide-react-native';
import { Button, LogoMark, Text, space, useTheme } from '@/ui';

const ANDROID_STORE = 'https://play.google.com/store/apps/details?id=com.geldesat.app';
const IOS_STORE = 'https://apps.apple.com/tr/search?term=GeldeSat';

/** Shown instead of the app when the admin panel requires a newer store version. */
export function ForceUpdate({ storeUrl }: { storeUrl?: string | null }) {
  const { c } = useTheme();
  const url = storeUrl || (Platform.OS === 'ios' ? IOS_STORE : ANDROID_STORE);
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <LogoMark size={64} />
      <Text variant="title" center>
        Güncelleme gerekli
      </Text>
      <Text tone="muted" center style={styles.text}>
        Bu GeldeSat sürümü artık desteklenmiyor. Uygulamayı kullanmaya devam etmek için mağazadan güncelleyin.
      </Text>
      <Button title="Uygulamayı güncelle" icon={Download} size="lg" onPress={() => void Linking.openURL(url).catch(() => undefined)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.lg },
  text: { maxWidth: 320 },
});
