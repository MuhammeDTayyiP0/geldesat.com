import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import { useSession } from '@/auth/session';
import { formatDate } from '@/lib/format';
import { Button, Text, hairline, space, toast, useTheme } from '@/ui';

/** Global alert bar shown while the signed-in account is scheduled for 30-day deletion. */
export function DeletionBanner() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [busy, setBusy] = useState(false);

  const deletion = useQuery({
    queryKey: keys.deletion,
    queryFn: account.deletionStatus,
    enabled: session.status === 'signedIn',
    staleTime: 60_000,
  });

  const purgeAt = session.status === 'signedIn' ? deletion.data?.purgeAt : null;
  if (!purgeAt) return null;

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await account.restore();
      await queryClient.invalidateQueries({ queryKey: keys.deletion });
      void queryClient.invalidateQueries({ queryKey: keys.myListings });
      void queryClient.invalidateQueries({ queryKey: keys.me });
      toast.success('Hesabınız geri alındı. İlanlarınız eski durumuna döndü.');
    } catch (e) {
      toast.error(errorMessage(e, 'Hesap geri alınamadı.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.bar,
        {
          paddingTop: insets.top + space.xs,
          backgroundColor: c.dangerSoft,
          borderBottomColor: c.danger,
        },
      ]}
    >
      <Text variant="caption" tone="danger" style={styles.flex}>
        Hesabınız {formatDate(purgeAt)} tarihinde silinecek; ilanlarınız şu an gizli.
      </Text>
      <Button title="Geri al" size="sm" loading={busy} onPress={() => void restore()} />
    </View>
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
