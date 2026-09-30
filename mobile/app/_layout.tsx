import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/components/useColorScheme';
import { restoreMobileSession } from '@/src/api/auth';
import { ActivityIndicator, DeviceEventEmitter, View } from 'react-native';
import { BrandColors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { addNotificationTapListener } from '@/src/services/notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// TanStack Query İstemcisi (Offline ve Hızlı Önbellek)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 dakika boyunca taze tut
      retry: 2,
    },
  },
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void restoreMobileSession().finally(() => {
      if (mounted) {
        setSessionReady(true);
        void SplashScreen.hideAsync();
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('geldesat:auth-expired', () => {
      router.replace('/login' as any);
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => addNotificationTapListener((link) => {
    const path = link.startsWith('http') ? new URL(link).pathname : link;
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'ilan' && parts[1]) router.push(`/ilan/${parts[1]}` as any);
    else if (parts[0] === 'mesajlar' && parts[1]) router.push(`/mesaj/${parts[1]}` as any);
    else if (parts[0] === 'mesajlar') router.push('/(tabs)/mesajlar' as any);
    else if (parts[0] === 'doping') router.push('/(tabs)/profil' as any);
  }), [router]);

  if (!sessionReady) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.background }}><ActivityIndicator color={BrandColors.primary} /></View>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
