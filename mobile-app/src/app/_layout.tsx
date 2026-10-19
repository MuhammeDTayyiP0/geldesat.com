import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { restoreSession } from '@/auth/auth';
import { useSession } from '@/auth/session';
import { clearPrivateQueries, queryClient, useCounts } from '@/api/queries';
import { resetChatStream, subscribeChatStream } from '@/features/chat/stream';
import { appRouteForWebPath } from '@/lib/links';
import { notificationLink, registerForPush } from '@/lib/push';
import { loadThemePref } from '@/lib/themePref';
import { ToastHost, useTheme } from '@/ui';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { dark, c } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([loadThemePref(), restoreSession()]).finally(() => {
      setReady(true);
      SplashScreen.hide();
    });
  }, []);

  const navTheme = dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: c.bg, card: c.surface, primary: c.primary, border: c.border, text: c.fg } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: c.bg, card: c.surface, primary: c.primary, border: c.border, text: c.fg } };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider value={navTheme}>
              <StatusBar style={dark ? 'light' : 'dark'} />
              {ready ? (
                <>
                  <SessionEffects />
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="ilan-ver" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="giris" options={{ presentation: 'modal' }} />
                  </Stack>
                </>
              ) : null}
              <ToastHost />
            </ThemeProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Push registration while signed in, cache reset on sign-out, and notification taps. */
function SessionEffects() {
  const session = useSession();
  const router = useRouter();
  const userId = session.status === 'signedIn' ? session.user.id : null;

  useEffect(() => {
    resetChatStream();
    if (!userId) {
      clearPrivateQueries();
      return;
    }
    void registerForPush().catch(() => undefined);
    // Live inbox: keep the tab badges and the conversation list current.
    return subscribeChatStream((event) => {
      if (event.type === 'new_message' || event.type === 'read_update' || event.type === 'inbox_ping') {
        void queryClient.invalidateQueries({ queryKey: ['counts'] });
        void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      } else if (event.type === 'notification') {
        void queryClient.invalidateQueries({ queryKey: ['counts'] });
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    });
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const link = notificationLink(response);
      const route = link ? appRouteForWebPath(link) : null;
      router.push(route ?? '/bildirimler');
      void queryClient.invalidateQueries({ queryKey: ['counts'] });
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ['counts'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    });
    return () => {
      sub.remove();
      received.remove();
    };
  }, [router]);

  return <AppBadge signedIn={!!userId} />;
}

/** Keep the app icon badge equal to unread notifications + messages (0 when signed out). */
function AppBadge({ signedIn }: { signedIn: boolean }) {
  const { data } = useCounts();
  const total = signedIn ? (data?.notifications ?? 0) + (data?.messages ?? 0) : 0;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void Notifications.setBadgeCountAsync(total).catch(() => undefined);
  }, [total]);
  return null;
}
