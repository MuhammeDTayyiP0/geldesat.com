import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Network from 'expo-network';
import { onlineManager } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react-native';
import { queryClient } from '@/api/queries';
import { Text, hairline, space, toast, useTheme } from '@/ui';

/** Global banner shown when the device loses network connectivity; invalidates active queries on reconnect. */
export function OfflineBanner({ children }: { children?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const network = Network.useNetworkState();
  // Treat only explicit false values as offline so initial undefined state never flashes a banner.
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    onlineManager.setOnline(!offline);
    if (wasOfflineRef.current && !offline) {
      void queryClient.invalidateQueries({ refetchType: 'active' });
      toast.success('İnternet bağlantısı geri geldi.');
    }
    wasOfflineRef.current = offline;
  }, [offline]);

  if (!offline) return <>{children}</>;

  return (
    <>
      <View
        accessibilityRole="alert"
        style={[
          styles.bar,
          {
            paddingTop: insets.top + space.xs,
            backgroundColor: c.warnSoft,
            borderBottomColor: c.warn,
          },
        ]}
      >
        <WifiOff size={16} color={c.warn} />
        <Text variant="caption" style={[styles.flex, { color: c.warn }]}>
          İnternet bağlantısı yok — bağlantı dönünce otomatik yenilenecek.
        </Text>
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: hairline,
  },
  flex: { flex: 1 },
});
