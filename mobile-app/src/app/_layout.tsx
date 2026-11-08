import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { CircleAlert } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { restoreSession } from '@/auth/auth';
import { useSession } from '@/auth/session';
import { clearPrivateQueries, queryClient, useConfig, useCounts } from '@/api/queries';
import { ForceUpdate } from '@/features/app/ForceUpdate';
import { onStreamResume, resetChatStream, subscribeChatStream } from '@/features/chat/stream';
import { appRouteForWebPath } from '@/lib/links';
import { ensurePushRegistered, notificationLink, registerForPush } from '@/lib/push';
import { loadCachedConfig } from '@/lib/configCache';
import { flushErrorReports, installGlobalErrorHandler, reportError, setErrorScreen } from '@/lib/errorReport';
import { useOtaUpdates } from '@/lib/ota';
import { loadThemePref } from '@/lib/themePref';
import { isOlderVersion } from '@/lib/version';
import { Button, Text, ToastHost, space, useTheme } from '@/ui';

void SplashScreen.preventAutoHideAsync();
installGlobalErrorHandler();

/**
 * A screen that throws while rendering lands here instead of closing the app.
 * Rendered in place of the whole layout, so it uses no providers.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { c } = useTheme();
  useEffect(() => {
    SplashScreen.hide();
    void reportError(error);
  }, [error]);
  return (
    <View style={[styles.crash, { backgroundColor: c.bg }]}>
      <CircleAlert size={40} color={c.danger} />
      <Text variant="title" center>
        Bir sorun oluştu
      </Text>
      <Text tone="muted" center style={styles.crashText}>
        Bu ekran açılamadı. Sorunu bize bildirdik. Tekrar deneyin ya da uygulamayı yeniden başlatın.
      </Text>
      <Button title="Tekrar dene" onPress={() => void retry()} />
      {Updates.isEnabled ? <Button title="Uygulamayı yeniden başlat" variant="ghost" onPress={() => void Updates.reloadAsync().catch(() => undefined)} /> : null}
    </View>
  );
}

export default function RootLayout() {
  const { dark, c } = useTheme();
  const [ready, setReady] = useState(false);
  useOtaUpdates();

  useEffect(() => {
    // All local reads: the stored session is checked with the server in the background.
    void Promise.all([loadThemePref(), restoreSession(), loadCachedConfig()]).finally(() => {
      setReady(true);
      SplashScreen.hide();
      void flushErrorReports();
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
                <UpdateGate>
                  <SessionEffects />
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="ilan-ver" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="giris" options={{ presentation: 'modal' }} />
                  </Stack>
                </UpdateGate>
              ) : null}
              <ToastHost />
            </ThemeProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** The admin panel's lowest supported store version (Ayarlar → Mobil uygulama): older apps only see the update screen. */
function UpdateGate({ children }: { children: React.ReactNode }) {
  const { data } = useConfig();
  const app = data?.mobileApp;
  const min = Platform.OS === 'ios' ? app?.min_ios_version : app?.min_android_version;
  if (Platform.OS !== 'web' && isOlderVersion(Constants.expoConfig?.version, min)) {
    return <ForceUpdate storeUrl={Platform.OS === 'ios' ? app?.ios_store_url : app?.android_store_url} />;
  }
  return children;
}

/** Push registration while signed in, cache reset on sign-out, and notification taps. */
function SessionEffects() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const userId = session.status === 'signedIn' ? session.user.id : null;
  const previousUser = useRef(userId);

  useEffect(() => {
    setErrorScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    resetChatStream();
    // However the session ended (sign-out, expired, deleted account), nothing of that account stays on screen.
    if (previousUser.current && previousUser.current !== userId) clearPrivateQueries();
    // Signed in: open listings learn the favorite and owner state of the account.
    if (userId && previousUser.current !== userId) void queryClient.invalidateQueries({ queryKey: ['listing'] });
    previousUser.current = userId;
    if (!userId) return;
    void registerForPush().catch(() => undefined);
    // Back in the foreground or reconnected: badges and the inbox may be minutes old.
    const offResume = onStreamResume(() => {
      void queryClient.invalidateQueries({ queryKey: ['counts'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    // Notifications allowed later in the phone's settings: register this device then.
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void ensurePushRegistered().catch(() => undefined);
    });
    // Live inbox: keep the tab badges and the conversation list current.
    const offStream = subscribeChatStream((event) => {
      if (event.type === 'new_message' || event.type === 'read_update' || event.type === 'inbox_ping') {
        void queryClient.invalidateQueries({ queryKey: ['counts'] });
        void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      } else if (event.type === 'notification') {
        void queryClient.invalidateQueries({ queryKey: ['counts'] });
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    });
    return () => {
      offResume();
      appState.remove();
      offStream();
    };
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const link = notificationLink(response);
      const route = link ? appRouteForWebPath(link) : null;
      // navigate, not push: tapping a second push for the open chat does not stack it again.
      router.navigate(route ?? '/bildirimler');
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

const styles = StyleSheet.create({
  crash: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md },
  crashText: { maxWidth: 320, marginBottom: space.sm },
});
