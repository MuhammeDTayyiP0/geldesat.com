import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useRouter, useScrollToTop } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Archive, ArchiveRestore, CheckCheck, ImageIcon, MailOpen, MessageCircle, Search, Trash2, type LucideIcon } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { chat } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { Conversation } from '@/api/types';
import { useSession } from '@/auth/session';
import { previewText } from '@/features/chat/shared';
import { mediaUrl } from '@/lib/config';
import { formatPrice, inboxTime } from '@/lib/format';
import {
  Avatar,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Loading,
  RowGroup,
  Segmented,
  Sheet,
  Text,
  confirm,
  font,
  hairline,
  radius,
  space,
  toast,
  useTheme,
} from '@/ui';

type Filter = 'all' | 'buying' | 'selling' | 'archived';

export default function InboxScreen() {
  const { c } = useTheme();
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<Conversation | null>(null);
  const inbox = useQuery({ queryKey: keys.inbox, queryFn: chat.inbox, enabled: session.status === 'signedIn', refetchInterval: 60_000 });

  const rows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr');
    return (inbox.data ?? []).filter((cv) => {
      if (filter === 'archived' ? !cv.archived : cv.archived) return false;
      if (filter === 'buying' && cv.role !== 'buying') return false;
      if (filter === 'selling' && cv.role !== 'selling') return false;
      if (!term) return true;
      return cv.other_name.toLocaleLowerCase('tr').includes(term) || cv.listing_title.toLocaleLowerCase('tr').includes(term);
    });
  }, [inbox.data, filter, q]);

  // The spinner only for a pull: background refreshes (every minute, on return) stay quiet.
  const [pulling, setPulling] = useState(false);
  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: keys.inbox }), queryClient.invalidateQueries({ queryKey: keys.counts })]);
  };
  const pull = async () => {
    setPulling(true);
    await refresh();
    setPulling(false);
  };

  const act = useMutation({
    mutationFn: async ({ cv, action }: { cv: Conversation; action: 'archive' | 'unarchive' | 'unread' | 'read' | 'delete' }) => {
      if (action === 'archive' || action === 'unarchive') await chat.archive(cv.id, action === 'archive');
      else if (action === 'unread') await chat.markUnread(cv.id, true);
      else if (action === 'read') await chat.markRead(cv.id);
      else await chat.remove(cv.id);
    },
    onSuccess: () => void refresh(),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const run = async (cv: Conversation, action: InboxAction) => {
    if (action === 'delete') {
      const ok = await confirm({
        title: 'Sohbet silinsin mi?',
        message: 'Sohbet yalnızca sizin kutunuzdan silinir; karşı taraf görmeye devam eder.',
        confirmText: 'Sil',
        destructive: true,
      });
      if (!ok) return;
    }
    act.mutate({ cv, action });
  };
  // From the menu sheet: act once it has closed (a confirm opened while it closes freezes the app).
  const afterMenu = useRef<(() => void) | null>(null);
  const fromMenu = (cv: Conversation, action: InboxAction) => {
    afterMenu.current = () => void run(cv, action);
    setMenu(null);
  };

  if (session.status !== 'signedIn') {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <EmptyState
          icon={MessageCircle}
          title="Mesajlarınız burada"
          message="Satıcılarla ve alıcılarla yazışmak için giriş yapın."
          action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />}
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm, backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Text variant="title">Mesajlar</Text>
        <View style={[styles.search, { backgroundColor: c.elevated }]}>
          <Search size={18} color={c.subtle} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Kişi veya ilan ara"
            placeholderTextColor={c.subtle}
            style={[styles.input, { color: c.fg }]}
            accessibilityLabel="Sohbetlerde ara"
          />
        </View>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'buying', label: 'Alıyorum' },
            { value: 'selling', label: 'Satıyorum' },
            { value: 'archived', label: 'Arşiv' },
          ]}
        />
      </View>

      {inbox.isLoading ? (
        <Loading />
      ) : inbox.isError && !inbox.data ? (
        <ErrorState error={inbox.error} onRetry={() => inbox.refetch()} />
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(cv) => cv.id}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} tintColor={c.primary} />}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <Divider inset={88} />}
          contentContainerStyle={rows.length ? undefined : styles.emptyWrap}
          ListEmptyComponent={
            <EmptyState
              icon={MessageCircle}
              title={q ? 'Sonuç yok' : filter === 'archived' ? 'Arşiv boş' : 'Henüz mesajınız yok'}
              message={q || filter === 'archived' ? undefined : 'Beğendiğiniz bir ilanda “Mesaj” ile satıcıya yazabilirsiniz.'}
            />
          }
          renderItem={({ item }) => (
            <SwipeableInboxRow cv={item} onAction={(action) => void run(item, action)}>
              <InboxRow
                cv={item}
                me={session.user.id}
                onPress={() => router.push({ pathname: '/mesaj/[id]', params: { id: item.id } })}
                onLongPress={() => setMenu(item)}
                onAction={(action) => void run(item, action)}
              />
            </SwipeableInboxRow>
          )}
        />
      )}

      <Sheet
        visible={!!menu}
        onClose={() => setMenu(null)}
        onDismissed={() => {
          const next = afterMenu.current;
          afterMenu.current = null;
          next?.();
        }}
        title={menu?.other_name}
        subtitle={menu?.listing_title}
      >
        {menu ? (
          <RowGroup>
            {menu.unread || menu.marked_unread ? (
              <ListRow icon={CheckCheck} label="Okundu işaretle" onPress={() => fromMenu(menu, 'read')} />
            ) : (
              <ListRow icon={MailOpen} label="Okunmadı işaretle" onPress={() => fromMenu(menu, 'unread')} />
            )}
            {menu.archived ? (
              <ListRow icon={ArchiveRestore} label="Arşivden çıkar" onPress={() => fromMenu(menu, 'unarchive')} />
            ) : (
              <ListRow icon={Archive} label="Arşivle" onPress={() => fromMenu(menu, 'archive')} />
            )}
            <ListRow icon={Trash2} label="Sohbeti sil" danger onPress={() => fromMenu(menu, 'delete')} />
          </RowGroup>
        ) : null}
      </Sheet>
    </View>
  );
}

type InboxAction = 'archive' | 'unarchive' | 'unread' | 'read' | 'delete';

/**
 * Swipe left for Arşivle / Sil, swipe right to toggle read; long press still
 * opens the full menu.
 */
function SwipeableInboxRow({ cv, onAction, children }: { cv: Conversation; onAction: (action: InboxAction) => void; children: ReactNode }) {
  const { c, dark } = useTheme();
  const unread = cv.unread > 0 || cv.marked_unread;
  const act = (methods: SwipeableMethods, action: InboxAction) => {
    methods.close();
    void Haptics.selectionAsync();
    onAction(action);
  };
  return (
    <Swipeable
      friction={1.6}
      leftThreshold={60}
      rightThreshold={60}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(_p, _t, methods) => (
        <SwipeAction
          color={c.primarySolid}
          icon={unread ? CheckCheck : MailOpen}
          label={unread ? 'Okundu' : 'Okunmadı'}
          onPress={() => act(methods, unread ? 'read' : 'unread')}
        />
      )}
      renderRightActions={(_p, _t, methods) => (
        <View style={styles.actions}>
          <SwipeAction
            color={dark ? '#475467' : c.muted}
            icon={cv.archived ? ArchiveRestore : Archive}
            label={cv.archived ? 'Çıkar' : 'Arşivle'}
            onPress={() => act(methods, cv.archived ? 'unarchive' : 'archive')}
          />
          <SwipeAction color={c.urgentSolid} icon={Trash2} label="Sil" onPress={() => act(methods, 'delete')} />
        </View>
      )}
    >
      {children}
    </Swipeable>
  );
}

function SwipeAction({ color, icon: Icon, label, onPress }: { color: string; icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.swipeAction, { backgroundColor: color }]}>
      <Icon size={22} color="#fff" />
      <Text variant="small" style={styles.swipeLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function InboxRow({
  cv,
  me,
  onPress,
  onLongPress,
  onAction,
}: {
  cv: Conversation;
  me: string;
  onPress: () => void;
  onLongPress: () => void;
  /** The swipe actions, offered to screen readers as actions on the row. */
  onAction: (action: InboxAction) => void;
}) {
  const { c } = useTheme();
  const unread = cv.unread > 0 || cv.marked_unread;
  const mine = cv.last_sender_id === me;
  const thumb = mediaUrl(cv.listing_image, 240);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={`${cv.other_name}, ${cv.listing_title}${unread ? ', okunmamış' : ''}`}
      accessibilityActions={[
        { name: 'longpress', label: 'Seçenekler' },
        { name: 'read', label: unread ? 'Okundu işaretle' : 'Okunmadı işaretle' },
        { name: 'archive', label: cv.archived ? 'Arşivden çıkar' : 'Arşivle' },
        { name: 'delete', label: 'Sohbeti sil' },
      ]}
      onAccessibilityAction={(e) => {
        const name = e.nativeEvent.actionName;
        if (name === 'longpress') onLongPress();
        else if (name === 'read') onAction(unread ? 'read' : 'unread');
        else if (name === 'archive') onAction(cv.archived ? 'unarchive' : 'archive');
        else if (name === 'delete') onAction('delete');
      }}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.elevated : c.surface }]}
    >
      <View>
        <View style={[styles.thumb, { backgroundColor: c.elevated }]}>
          {thumb ? <Image source={thumb} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ImageIcon size={22} color={c.subtle} />}
        </View>
        <View style={[styles.avatar, { borderColor: c.surface }]}>
          <Avatar name={cv.other_name} uri={cv.other_avatar} size={26} />
        </View>
        {cv.other_online ? <View style={[styles.online, { backgroundColor: c.ok, borderColor: c.surface }]} /> : null}
      </View>
      <View style={styles.body}>
        <View style={styles.line}>
          <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={1} style={styles.flex}>
            {cv.other_name}
          </Text>
          <Text variant="small" tone={unread ? 'primary' : 'subtle'}>
            {inboxTime(cv.updated_at)}
          </Text>
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {cv.listing_title}
          {cv.price ? ` · ${formatPrice(cv.price)}` : ''}
        </Text>
        <View style={styles.line}>
          <Text variant="caption" tone={unread ? 'default' : 'subtle'} numberOfLines={1} style={[styles.flex, unread && styles.bold]}>
            {mine ? 'Siz: ' : ''}
            {previewText(cv.last_kind, cv.last_content, cv.last_deleted)}
          </Text>
          {cv.unread ? (
            <View style={[styles.badge, { backgroundColor: c.primarySolid }]}>
              <Text variant="small" style={styles.badgeText}>
                {cv.unread > 99 ? '99+' : cv.unread}
              </Text>
            </View>
          ) : cv.marked_unread ? (
            <View style={[styles.dot, { backgroundColor: c.primary }]} />
          ) : null}
        </View>
        {cv.listing_status !== 'ACTIVE' ? (
          <Text variant="small" tone="warn">
            {cv.listing_status === 'SOLD' ? 'İlan satıldı' : cv.listing_status === 'REMOVED' ? 'İlan kaldırıldı' : 'İlan yayında değil'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row' },
  swipeAction: { width: 82, alignItems: 'center', justifyContent: 'center', gap: 4 },
  swipeLabel: { color: '#fff', fontWeight: '700' },
  flex: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md, borderBottomWidth: hairline },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 42, borderRadius: radius.md, paddingHorizontal: space.md },
  input: { flex: 1, fontSize: font.md, height: 42 },
  emptyWrap: { flexGrow: 1 },
  row: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  thumb: { width: 58, height: 58, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatar: { position: 'absolute', right: -6, bottom: -6, borderWidth: 2, borderRadius: 15 },
  online: { position: 'absolute', left: -2, top: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  body: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bold: { fontWeight: '600' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
