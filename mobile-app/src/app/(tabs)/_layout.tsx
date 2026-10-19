import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Compass, MessageCircle, Plus, Search, UserRound, type LucideIcon } from 'lucide-react-native';
import { useCounts } from '@/api/queries';
import { CountDot, Text, hairline, shadow, space, useTheme } from '@/ui';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Keşfet', icon: Compass },
  ara: { label: 'Ara', icon: Search },
  yeni: { label: 'İlan Ver', icon: Plus },
  mesajlar: { label: 'Mesajlar', icon: MessageCircle },
  hesap: { label: 'Hesabım', icon: UserRound },
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="ara" />
      <Tabs.Screen name="yeni" />
      <Tabs.Screen name="mesajlar" />
      <Tabs.Screen name="hesap" />
    </Tabs>
  );
}

function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: counts } = useCounts();

  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const Icon = tab.icon;

        if (route.name === 'yeni') {
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel="İlan ver"
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/ilan-ver');
              }}
              style={styles.item}
            >
              <View style={[styles.post, { backgroundColor: c.primary }, shadow(2)]}>
                <Plus size={26} color={c.onPrimary} strokeWidth={2.6} />
              </View>
              <Text variant="small" tone="primary" style={styles.postLabel}>
                {tab.label}
              </Text>
            </Pressable>
          );
        }

        const badge = route.name === 'mesajlar' ? (counts?.messages ?? 0) : route.name === 'hesap' ? (counts?.notifications ?? 0) : 0;
        const color = focused ? c.primary : c.subtle;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${tab.label}, ${badge} okunmamış` : tab.label}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                void Haptics.selectionAsync();
                navigateToTab(route.key);
              }
            }}
            style={styles.item}
          >
            <View>
              <Icon size={24} color={color} strokeWidth={focused ? 2.4 : 2} />
              <CountDot count={badge} />
            </View>
            <Text variant="small" style={{ color, fontWeight: focused ? '700' : '500' }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: hairline, paddingTop: space.sm },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3, minHeight: 48 },
  post: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: -22 },
  postLabel: { fontWeight: '700' },
});
