import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck, Clock, Heart, LayoutGrid, MessageCircle, type LucideIcon } from 'lucide-react-native';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { AppNotification } from '@/api/types';
import { useSession } from '@/auth/session';
import { appRouteForWebPath } from '@/lib/links';
import { timeAgo } from '@/lib/format';
import { Button, Divider, EmptyState, ErrorState, Header, IconButton, Loading, Text, space, useTheme } from '@/ui';

const ICONS: Record<string, LucideIcon> = { message: MessageCircle, favorite: Heart, listing: LayoutGrid, expiry: Clock };

export default function NotificationsScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const session = useSession();
  const query = useQuery({ queryKey: keys.notifications, queryFn: account.notifications, enabled: session.status === 'signedIn' });
  const markAll = useMutation({
    mutationFn: account.markNotificationsRead,
    onSuccess: () => {
      queryClient.setQueryData<{ notifications: AppNotification[]; unread: number }>(keys.notifications, (d) =>
        d ? { unread: 0, notifications: d.notifications.map((n) => ({ ...n, read: true })) } : d,
      );
      void queryClient.invalidateQueries({ queryKey: keys.counts });
    },
  });

  // Opening the list counts as reading it (like the website), after a short look.
  const unread = query.data?.unread ?? 0;
  useEffect(() => {
    if (!unread) return;
    const t = setTimeout(() => markAll.mutate(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  const open = (n: AppNotification) => {
    const route = appRouteForWebPath(n.link);
    if (route) router.push(route);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header
        title="Bildirimler"
        right={unread ? <IconButton icon={CheckCheck} label="Tümünü okundu işaretle" onPress={() => markAll.mutate()} /> : undefined}
      />
      {session.status !== 'signedIn' ? (
        <EmptyState icon={Bell} title="Giriş yapın" action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />} />
      ) : query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data?.notifications ?? []}
          keyExtractor={(n) => n.id}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.primary} />}
          ItemSeparatorComponent={() => <Divider inset={72} />}
          contentContainerStyle={query.data?.notifications.length ? undefined : styles.flexGrow}
          ListEmptyComponent={
            <EmptyState icon={Bell} title="Bildirim yok" message="Mesaj, favori ve ilan durumu bildirimleriniz burada görünür." />
          }
          renderItem={({ item }) => {
            const Icon = ICONS[item.type] ?? Bell;
            return (
              <Pressable
                onPress={() => open(item)}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.elevated : item.read ? c.surface : c.primarySoft }]}
              >
                <View style={[styles.icon, { backgroundColor: item.read ? c.elevated : c.surface }]}>
                  <Icon size={20} color={c.primary} />
                </View>
                <View style={styles.flex}>
                  <Text variant={item.read ? 'body' : 'bodyStrong'}>{item.title}</Text>
                  {item.body ? (
                    <Text variant="caption" tone="muted" numberOfLines={2}>
                      {item.body}
                    </Text>
                  ) : null}
                  <Text variant="small" tone="subtle">
                    {timeAgo(item.created_at)}
                  </Text>
                </View>
                {!item.read ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  row: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, alignItems: 'center' },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
