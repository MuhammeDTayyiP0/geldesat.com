import { FlatList, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ban } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { BlockedUser } from '@/api/types';
import { formatDate } from '@/lib/format';
import { Avatar, Button, Divider, EmptyState, ErrorState, Header, Loading, Text, space, toast, useTheme } from '@/ui';

export default function BlockedUsersScreen() {
  const { c } = useTheme();
  const query = useQuery({ queryKey: keys.blocked, queryFn: account.blocked });
  const unblock = useMutation({
    mutationFn: (userId: string) => account.unblock(userId),
    onSuccess: (_, userId) => {
      queryClient.setQueryData<BlockedUser[]>(keys.blocked, (list) => list?.filter((u) => u.id !== userId));
      toast.success('Engel kaldırıldı');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Engellenen kullanıcılar" />
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(u) => u.id}
          ItemSeparatorComponent={() => <Divider inset={72} />}
          contentContainerStyle={query.data?.length ? undefined : styles.grow}
          ListEmptyComponent={<EmptyState icon={Ban} title="Engellediğiniz kimse yok" message="Engellediğiniz kişiler size mesaj gönderemez." />}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: c.surface }]}>
              <Avatar name={item.name} uri={item.avatar} size={44} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{item.name}</Text>
                <Text variant="caption" tone="subtle">
                  {formatDate(item.since)} tarihinde engellendi
                </Text>
              </View>
              <Button title="Kaldır" size="sm" variant="outline" loading={unblock.isPending && unblock.variables === item.id} onPress={() => unblock.mutate(item.id)} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
