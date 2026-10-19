import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react-native';
import { setThemePref, useThemePref, type ThemePref } from '@/lib/themePref';
import { Divider, Header, Text, hairline, radius, space, useTheme } from '@/ui';

const OPTIONS: { value: ThemePref; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Cihaz ayarı', hint: 'Telefonunuz hangi moddaysa', icon: Monitor },
  { value: 'light', label: 'Açık', hint: 'Her zaman açık renkler', icon: Sun },
  { value: 'dark', label: 'Koyu', hint: 'Her zaman koyu renkler; gece göz yormaz', icon: Moon },
];

export default function AppearanceScreen() {
  const { c } = useTheme();
  const pref = useThemePref();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Görünüm" />
      <ScrollView contentContainerStyle={styles.body}>
        <View accessibilityRole="radiogroup" style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
          {OPTIONS.map((o, i) => {
            const selected = pref === o.value;
            return (
              <View key={o.value}>
                {i ? <Divider inset={68} /> : null}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setThemePref(o.value);
                  }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.elevated }]}
                >
                  <View style={[styles.icon, { backgroundColor: selected ? c.primary : c.elevated }]}>
                    <o.icon size={20} color={selected ? c.onPrimary : c.muted} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{o.label}</Text>
                    <Text variant="caption" tone="muted">
                      {o.hint}
                    </Text>
                  </View>
                  <View style={[styles.radio, { borderColor: selected ? c.primary : c.borderStrong, backgroundColor: selected ? c.primary : 'transparent' }]}>
                    {selected ? <Check size={14} color={c.onPrimary} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
        <Text variant="caption" tone="subtle">
          Seçiminiz bu cihazda saklanır.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md },
  group: { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 68 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
