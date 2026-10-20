import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  Copy,
  Flag,
  HandCoins,
  ImagePlus,
  MapPin,
  MoreVertical,
  Plus,
  Reply,
  Search,
  Send,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account, chat, uploads } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { ChatMessage } from '@/api/types';
import { getToken, useSession } from '@/auth/session';
import { Bubble } from '@/features/chat/Bubble';
import { SwipeToReply } from '@/features/chat/SwipeToReply';
import { LocationPicker } from '@/features/chat/LocationPicker';
import { BUYER_QUICK_REPLIES, CHAT_REPORT_REASONS, DELETE_WINDOW_MS, SELLER_QUICK_REPLIES } from '@/features/chat/shared';
import { onStreamResume, subscribeChatStream } from '@/features/chat/stream';
import { PhotoViewer } from '@/features/listing/Gallery';
import { mediaUrl } from '@/lib/config';
import { dayLabel, formatPrice, formatTime, lastSeenLabel, maskThousands, parseMasked } from '@/lib/format';
import { pickPhotos, preparePhoto } from '@/lib/photos';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  ListRow,
  Loading,
  RowGroup,
  Sheet,
  Text,
  confirm,
  font,
  hairline,
  radius,
  space,
  toast,
  useTheme,
  type TextInputRef,
} from '@/ui';

type Row = { type: 'message'; message: ChatMessage; grouped: boolean } | { type: 'day'; key: string; label: string };
type SheetName = 'attach' | 'offer' | 'location' | 'menu' | 'report' | 'search' | 'actions' | 'info' | null;

function sortMessages(list: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of list) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const me = session.status === 'signedIn' ? session.user.id : '';
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${getToken() ?? ''}` }), []);

  const thread = useQuery({ queryKey: keys.thread(id), queryFn: () => chat.thread(id), staleTime: 0, enabled: !!me, refetchOnReconnect: false });
  const templates = useQuery({ queryKey: keys.templates, queryFn: chat.templates, enabled: !!me, staleTime: 5 * 60_000 });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [jumped, setJumped] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [quick, setQuick] = useState(false);
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState<{ online: boolean; lastSeen: string | null }>({ online: false, lastSeen: null });
  const [sheet, setSheet] = useState<SheetName>(null);
  // Next step chosen in a sheet (photo picker, another sheet, a confirm), run
  // once that sheet's modal is gone: opening it earlier freezes the app.
  const afterClose = useRef<(() => void) | null>(null);
  const thenClose = (next: () => void) => {
    afterClose.current = next;
    setSheet(null);
  };
  const runAfterClose = () => {
    const next = afterClose.current;
    afterClose.current = null;
    next?.();
  };
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [selectedDeletable, setSelectedDeletable] = useState(false);
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const awayRef = useRef(false);
  const inputRef = useRef<TextInputRef>(null);
  const [counterTo, setCounterTo] = useState<ChatMessage | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const listRef = useRef<FlatList<Row>>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const data = thread.data;
  const conv = data?.conversation;

  // Take the server's page whenever the thread (re)loads; live events add to it afterwards.
  const [syncedAt, setSyncedAt] = useState(0);
  if (data && thread.dataUpdatedAt !== syncedAt) {
    setSyncedAt(thread.dataUpdatedAt);
    setMessages(data.messages);
    setHasMore(data.hasMore);
    setJumped(false);
    setPresence({ online: data.conversation.other_online, lastSeen: data.conversation.other_last_seen });
  }

  const markRead = useCallback(() => {
    void chat
      .markRead(id)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: keys.counts });
        void queryClient.invalidateQueries({ queryKey: keys.inbox });
      })
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (data) markRead();
  }, [data, markRead]);

  // Live events for this chat.
  useEffect(() => {
    if (!me) return;
    const off = subscribeChatStream((event) => {
      if (event.conversationId !== id) return;
      if (event.type === 'message' || event.type === 'message_update') {
        const msg = event.message as ChatMessage;
        setMessages((list) => sortMessages([...list, { ...msg, kind: msg.kind ?? 'text', meta: msg.meta ?? null, deleted: !!msg.deleted, reply: msg.reply ?? null }]));
        if (event.type === 'message' && msg.sender_id !== me && awayRef.current) setUnseen((n) => n + 1);
        if (event.type === 'message' && msg.sender_id !== me) {
          setTyping(false);
          markRead();
        }
      } else if (event.type === 'read') {
        const reads = new Map((event.reads as { id: string; read_at: string }[]).map((r) => [r.id, r.read_at]));
        setMessages((list) => list.map((m) => (reads.has(m.id) ? { ...m, read_at: reads.get(m.id) ?? m.read_at } : m)));
      } else if (event.type === 'typing' && event.userId !== me) {
        setTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 4000);
      }
    }, id);
    const offResume = onStreamResume(() => {
      // Catch up on anything sent while the app was in the background.
      const last = messagesRef.current[messagesRef.current.length - 1];
      if (!last) return;
      void chat
        .poll(id, last.created_at)
        .then((r) => {
          const reads = new Map(r.reads.map((x) => [x.id, x.read_at]));
          setMessages((cur) => sortMessages([...cur, ...r.messages]).map((m) => (reads.has(m.id) ? { ...m, read_at: reads.get(m.id) ?? m.read_at } : m)));
          setPresence({ online: r.other_online, lastSeen: r.other_last_seen });
          if (r.messages.some((m) => m.sender_id !== me)) markRead();
        })
        .catch(() => undefined);
    });
    return () => {
      off();
      offResume();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [id, me, markRead]);

  // Inverted list: newest first, with day separators.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const prev = messages[i - 1];
      const sameDay = prev && prev.created_at.slice(0, 10) === m.created_at.slice(0, 10);
      const grouped = !!prev && sameDay && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
      out.push({ type: 'message', message: m, grouped });
      if (!sameDay) out.push({ type: 'day', key: `day-${m.created_at.slice(0, 10)}`, label: dayLabel(m.created_at) });
    }
    return out;
  }, [messages]);

  const loadOlder = async () => {
    if (!hasMore || loadingOlder || !messages[0]) return;
    setLoadingOlder(true);
    try {
      const r = await chat.older(id, messages[0].created_at);
      setMessages((list) => sortMessages([...r.messages, ...list]));
      setHasMore(r.hasMore);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingOlder(false);
    }
  };

  const appendOwn = (msg: ChatMessage) => setMessages((list) => sortMessages([...list, msg]));

  const send = async (content: string) => {
    const value = content.trim();
    if (!value || sending) return;
    setSending(true);
    const reply = replyTo;
    setText('');
    setReplyTo(null);
    setQuick(false);
    try {
      appendOwn(await chat.send(id, value, reply?.id));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void queryClient.invalidateQueries({ queryKey: keys.inbox });
    } catch (e) {
      setText(value);
      setReplyTo(reply);
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const onChangeText = (value: string) => {
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > 3000) {
      lastTypingSent.current = now;
      void chat.typing(id).catch(() => undefined);
    }
  };

  const sendPhoto = async (source: 'camera' | 'library') => {
    setSheet(null);
    const [picked] = await pickPhotos(source, 1);
    if (!picked) return;
    setSending(true);
    try {
      const prepared = await preparePhoto(picked);
      appendOwn(await uploads.chatPhoto(id, prepared));
      void queryClient.invalidateQueries({ queryKey: keys.inbox });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const respondOffer = async (m: ChatMessage, action: 'accept' | 'reject' | 'counter') => {
    if (action === 'counter') {
      setCounterTo(m);
      setSheet('offer');
      return;
    }
    const ok = await confirm({
      title: action === 'accept' ? 'Teklif kabul edilsin mi?' : 'Teklif reddedilsin mi?',
      message: `${formatPrice(m.meta?.amount ?? 0)} teklif`,
      confirmText: action === 'accept' ? 'Kabul et' : 'Reddet',
      destructive: action === 'reject',
    });
    if (!ok) return;
    try {
      const updated = await chat.respondOffer(m.id, action === 'accept');
      setMessages((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(action === 'accept' ? 'Teklif kabul edildi. Buluşmayı mesajlaşarak ayarlayabilirsiniz.' : 'Teklif reddedildi');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const jumpTo = async (messageId: string) => {
    if (messages.some((m) => m.id === messageId)) {
      const index = rows.findIndex((r) => r.type === 'message' && r.message.id === messageId);
      if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    } else {
      try {
        const r = await chat.around(id, messageId);
        setMessages(r.messages);
        setHasMore(r.hasMoreBefore);
        setJumped(r.hasMoreAfter);
      } catch (e) {
        toast.error(errorMessage(e));
        return;
      }
    }
    setHighlight(messageId);
    setTimeout(() => setHighlight(null), 2200);
  };

  if (!me) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <EmptyState icon={Ban} title="Giriş yapın" action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />} />
      </View>
    );
  }

  if (thread.isError) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <IconButton icon={ChevronLeft} label="Geri" onPress={() => router.back()} />
        <ErrorState error={thread.error} onRetry={() => thread.refetch()} />
      </View>
    );
  }
  if (!data || !conv) return <Loading />;

  const blocked = data.blockedByMe || data.blockedByOther || conv.other_closed;
  const buying = conv.role === 'buying';
  const quickReplies = [...(templates.data ?? []), ...(buying ? BUYER_QUICK_REPLIES : SELLER_QUICK_REPLIES)];
  const status = typing ? 'yazıyor…' : lastSeenLabel(presence.online, presence.lastSeen);
  const pendingOfferFromOther = [...messages].reverse().find((m) => m.kind === 'offer' && m.meta?.status === 'pending' && m.sender_id !== me);
  const listingThumb = mediaUrl(conv.listing_image, 240);

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.xs, backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.headRow}>
          <IconButton icon={ChevronLeft} label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/mesajlar'))} />
          <Pressable
            style={styles.person}
            onPress={() => !conv.other_closed && router.push({ pathname: '/satici/[id]', params: { id: conv.other_id } })}
          >
            <Avatar name={conv.other_name} uri={conv.other_avatar} size={38} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {conv.other_name}
              </Text>
              {status ? (
                <Text variant="small" tone={typing || presence.online ? 'ok' : 'subtle'} numberOfLines={1}>
                  {status}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <IconButton icon={Search} label="Sohbette ara" onPress={() => setSheet('search')} />
          <IconButton icon={MoreVertical} label="Seçenekler" onPress={() => setSheet('menu')} />
        </View>
        <Pressable
          onPress={() => conv.listing_id && router.push({ pathname: '/ilan/[id]', params: { id: conv.listing_id } })}
          style={[styles.listing, { backgroundColor: c.elevated }]}
        >
          <View style={[styles.listingThumb, { backgroundColor: c.border }]}>
            {listingThumb ? <Image source={listingThumb} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
          <View style={styles.flex}>
            <Text variant="caption" numberOfLines={1}>
              {conv.listing_title}
            </Text>
            <Text variant="label" tone="primary">
              {conv.listing_price ? formatPrice(conv.listing_price) : ''}
              {conv.listing_status !== 'ACTIVE' ? (
                <Text variant="small" tone="warn">
                  {'  '}
                  {conv.listing_status === 'SOLD' ? 'Satıldı' : 'Yayında değil'}
                </Text>
              ) : null}
            </Text>
          </View>
          {buying && conv.listing_status === 'ACTIVE' && !blocked ? (
            <Button
              title="Teklif"
              icon={HandCoins}
              size="sm"
              variant="soft"
              onPress={() => {
                setCounterTo(null);
                setSheet('offer');
              }}
            />
          ) : null}
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <FlatList
          ref={listRef}
          data={rows}
          inverted
          keyExtractor={(r) => (r.type === 'day' ? r.key : r.message.id)}
          contentContainerStyle={styles.list}
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.3}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={() => undefined}
          scrollEventThrottle={64}
          onScroll={(e) => {
            // Inverted list: offset 0 is the newest message.
            const isAway = e.nativeEvent.contentOffset.y > 320;
            if (isAway !== awayRef.current) {
              awayRef.current = isAway;
              setAway(isAway);
              if (!isAway) setUnseen(0);
            }
          }}
          ListFooterComponent={loadingOlder ? <ActivityIndicator color={c.primary} style={styles.older} /> : undefined}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text tone="muted" center>
                Sohbete bir mesajla başlayın.
              </Text>
            </View>
          }
          renderItem={({ item }) =>
            item.type === 'day' ? (
              <View style={styles.day}>
                <View style={[styles.dayPill, { backgroundColor: c.elevated }]}>
                  <Text variant="small" tone="muted">
                    {item.label}
                  </Text>
                </View>
              </View>
            ) : (
              <SwipeToReply
                disabled={blocked || item.message.deleted}
                onReply={() => {
                  setReplyTo(item.message);
                  inputRef.current?.focus();
                }}
                onInfo={
                  item.message.sender_id === me && !item.message.deleted
                    ? () => {
                        setSelected(item.message);
                        setSheet('info');
                      }
                    : undefined
                }
              >
              <Bubble
                message={item.message}
                mine={item.message.sender_id === me}
                showReads={data.showReads}
                authHeaders={authHeaders}
                grouped={item.grouped}
                highlighted={highlight === item.message.id}
                otherName={conv.other_name}
                listingImage={conv.listing_image}
                onLongPress={(m) => {
                  void Haptics.selectionAsync();
                  setSelected(m);
                  setSelectedDeletable(m.sender_id === me && Date.now() - new Date(m.created_at).getTime() < DELETE_WINDOW_MS);
                  setSheet('actions');
                }}
                onOpenImage={setViewer}
                onQuotePress={(mid) => void jumpTo(mid)}
                onOffer={(m, a) => void respondOffer(m, a)}
              />
              </SwipeToReply>
            )
          }
        />

        {away && !jumped ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unseen ? `En alta git, ${unseen} yeni mesaj` : 'En alta git'}
            onPress={() => {
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
              setUnseen(0);
            }}
            style={[styles.toBottom, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <ChevronDown size={22} color={c.fg} />
            {unseen ? (
              <View style={[styles.toBottomBadge, { backgroundColor: c.primary }]}>
                <Text variant="small" style={styles.toBottomText}>
                  {unseen > 99 ? '99+' : unseen}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {jumped ? (
          <Pressable onPress={() => void thread.refetch()} style={[styles.latest, { backgroundColor: c.ink }]}>
            <Text variant="label" tone="inverse">
              En yeni mesajlara dön
            </Text>
          </Pressable>
        ) : null}

        {blocked ? (
          <View style={[styles.blocked, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: insets.bottom + space.md }]}>
            <Text tone="muted" center>
              {conv.other_closed
                ? 'Bu kullanıcı hesabını kapattı. Mesaj gönderilemez.'
                : data.blockedByMe
                  ? 'Bu kullanıcıyı engellediniz.'
                  : 'Bu kullanıcıyla mesajlaşamazsınız.'}
            </Text>
            {data.blockedByMe ? (
              <Button
                title="Engeli kaldır"
                variant="outline"
                size="sm"
                onPress={async () => {
                  try {
                    await account.unblock(conv.other_id);
                    void thread.refetch();
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              />
            ) : null}
          </View>
        ) : (
          <View style={[styles.composer, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: insets.bottom + space.sm }]}>
            {pendingOfferFromOther && !quick && !replyTo ? (
              <Text variant="small" tone="primary" style={styles.offerHint}>
                {conv.other_name} {formatPrice(pendingOfferFromOther.meta?.amount ?? 0)} teklif verdi. Yukarıdan yanıtlayabilirsiniz.
              </Text>
            ) : null}
            {quick ? (
              <FlatList
                horizontal
                data={quickReplies}
                keyExtractor={(q, i) => `${i}-${q}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quick}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => <Chip label={item} onPress={() => void send(item)} />}
              />
            ) : null}
            {replyTo ? (
              <View style={[styles.replyBar, { backgroundColor: c.elevated, borderLeftColor: c.primary }]}>
                <View style={styles.flex}>
                  <Text variant="small" tone="primary">
                    {replyTo.sender_id === me ? 'Kendinize yanıt' : `${conv.other_name} kişisine yanıt`}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {replyTo.kind === 'image' ? '📷 Fotoğraf' : replyTo.content}
                  </Text>
                </View>
                <IconButton icon={X} label="Yanıtı iptal et" size={30} onPress={() => setReplyTo(null)} />
              </View>
            ) : null}
            <View style={styles.inputRow}>
              <IconButton icon={Plus} label="Ekle" onPress={() => setSheet('attach')} />
              <View style={[styles.inputWrap, { backgroundColor: c.elevated }]}>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={onChangeText}
                  placeholder="Mesaj yazın"
                  placeholderTextColor={c.subtle}
                  multiline
                  maxLength={2000}
                  style={[styles.input, { color: c.fg }]}
                  accessibilityLabel="Mesaj"
                />
                <Pressable hitSlop={8} onPress={() => setQuick((v) => !v)} accessibilityLabel="Hazır yanıtlar">
                  <Zap size={18} color={quick ? c.primary : c.subtle} />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Gönder"
                disabled={!text.trim() || sending}
                onPress={() => void send(text)}
                style={[styles.send, { backgroundColor: text.trim() ? c.primary : c.elevated }]}
              >
                {sending ? <ActivityIndicator color={text.trim() ? '#fff' : c.primary} size="small" /> : <Send size={18} color={text.trim() ? '#fff' : c.subtle} />}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <PhotoViewer images={viewer ? [viewer] : []} start={viewer ? 0 : null} headers={authHeaders} onClose={() => setViewer(null)} />

      <Sheet visible={sheet === 'attach'} onClose={() => setSheet(null)} onDismissed={runAfterClose} title="Gönder">
        <RowGroup>
          <ListRow icon={ImagePlus} label="Galeriden fotoğraf" onPress={() => thenClose(() => void sendPhoto('library'))} />
          <ListRow icon={ImagePlus} label="Fotoğraf çek" onPress={() => thenClose(() => void sendPhoto('camera'))} />
          <ListRow icon={MapPin} label="Buluşma noktası paylaş" onPress={() => thenClose(() => setSheet('location'))} />
          {buying && conv.listing_status === 'ACTIVE' ? (
            <ListRow
              icon={HandCoins}
              label="Teklif ver"
              onPress={() =>
                thenClose(() => {
                  setCounterTo(null);
                  setSheet('offer');
                })
              }
            />
          ) : null}
        </RowGroup>
      </Sheet>

      <OfferComposer
        visible={sheet === 'offer'}
        onClose={() => setSheet(null)}
        listingPrice={conv.listing_price}
        counterTo={counterTo}
        onSend={async (amount) => {
          const msg = await chat.offer(id, amount, counterTo?.id);
          setMessages((list) =>
            sortMessages([
              ...list.map((m) => (m.kind === 'offer' && m.meta?.status === 'pending' ? { ...m, meta: { ...m.meta, status: m.id === counterTo?.id ? ('countered' as const) : ('withdrawn' as const) } } : m)),
              msg,
            ]),
          );
          setSheet(null);
          toast.success(counterTo ? 'Karşı teklif gönderildi' : 'Teklif gönderildi');
        }}
      />

      <LocationPicker visible={sheet === 'location'} onClose={() => setSheet(null)} onSend={async (label, lat, lng) => appendOwn(await chat.sendLocation(id, label, lat, lng))} />

      <Sheet visible={sheet === 'info'} onClose={() => setSheet(null)} title="Mesaj bilgisi">
        {selected ? (
          <>
            <View style={[styles.infoPreview, { backgroundColor: c.elevated }]}>
              <Text numberOfLines={4}>{selected.kind === 'image' ? '📷 Fotoğraf' : selected.content}</Text>
            </View>
            <RowGroup>
              <ListRow icon={Check} label="Gönderildi" value={`${dayLabel(selected.created_at)} ${formatTime(selected.created_at)}`} />
              <ListRow
                icon={CheckCheck}
                label="Okundu"
                value={
                  !data.showReads
                    ? 'Okundu bilgisi kapalı'
                    : selected.read_at
                      ? `${dayLabel(selected.read_at)} ${formatTime(selected.read_at)}`
                      : 'Henüz okunmadı'
                }
              />
            </RowGroup>
          </>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'actions'} onClose={() => setSheet(null)} onDismissed={runAfterClose} title="Mesaj">
        {selected ? (
          <RowGroup>
            <ListRow
              icon={Reply}
              label="Yanıtla"
              onPress={() => {
                setReplyTo(selected);
                setSheet(null);
              }}
            />
            {selected.kind === 'text' ? (
              <ListRow
                icon={Copy}
                label="Kopyala"
                onPress={() => {
                  void Clipboard.setStringAsync(selected.content);
                  setSheet(null);
                  toast.success('Kopyalandı');
                }}
              />
            ) : null}
            {selectedDeletable ? (
              <ListRow
                icon={Trash2}
                label="Herkesten sil"
                danger
                onPress={() =>
                  thenClose(async () => {
                    const ok = await confirm({ title: 'Mesaj herkesten silinsin mi?', confirmText: 'Sil', destructive: true });
                    if (!ok) return;
                    try {
                      const updated = await chat.deleteMessage(selected.id);
                      setMessages((list) => list.map((m) => (m.id === updated.id ? updated : m)));
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  })
                }
              />
            ) : null}
            {selected.sender_id !== me ? (
              <ListRow icon={Flag} label="Mesajı bildir" danger onPress={() => thenClose(() => setSheet('report'))} />
            ) : null}
          </RowGroup>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} onDismissed={runAfterClose} title={conv.other_name}>
        <RowGroup>
          <ListRow
            icon={Ban}
            label={data.blockedByMe ? 'Engeli kaldır' : 'Kullanıcıyı engelle'}
            danger={!data.blockedByMe}
            onPress={() =>
              thenClose(async () => {
                if (!data.blockedByMe) {
                  const ok = await confirm({
                    title: `${conv.other_name} engellensin mi?`,
                    message: 'Engellediğiniz kişi size mesaj gönderemez. Engeli Ayarlar’dan kaldırabilirsiniz.',
                    confirmText: 'Engelle',
                    destructive: true,
                  });
                  if (!ok) return;
                }
                try {
                  if (data.blockedByMe) await account.unblock(conv.other_id);
                  else await account.block(conv.other_id);
                  void thread.refetch();
                  void queryClient.invalidateQueries({ queryKey: keys.blocked });
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              })
            }
          />
          <ListRow
            icon={Flag}
            label="Sohbeti bildir"
            danger
            onPress={() =>
              thenClose(() => {
                setSelected(null);
                setSheet('report');
              })
            }
          />
          <ListRow
            icon={Trash2}
            label="Sohbeti sil"
            danger
            onPress={() =>
              thenClose(async () => {
                const ok = await confirm({ title: 'Sohbet silinsin mi?', message: 'Yalnızca sizin kutunuzdan silinir.', confirmText: 'Sil', destructive: true });
                if (!ok) return;
                try {
                  await chat.remove(id);
                  void queryClient.invalidateQueries({ queryKey: keys.inbox });
                  router.back();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              })
            }
          />
        </RowGroup>
      </Sheet>

      <ReportComposer
        visible={sheet === 'report'}
        onClose={() => setSheet(null)}
        onSend={async (reason, details) => {
          await chat.report(id, reason, details, selected?.id);
          toast.success('Bildiriminiz alındı. Teşekkürler.');
          setSheet(null);
        }}
      />

      <SearchSheet
        visible={sheet === 'search'}
        conversationId={id}
        onClose={() => setSheet(null)}
        onPick={(mid) => {
          setSheet(null);
          void jumpTo(mid);
        }}
      />
    </View>
  );
}

function OfferComposer({
  visible,
  onClose,
  listingPrice,
  counterTo,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  listingPrice: number | null;
  counterTo: ChatMessage | null;
  onSend: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const value = parseMasked(amount) ?? 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={counterTo ? 'Karşı teklif' : 'Teklif ver'}
      subtitle={
        counterTo ? `Gelen teklif: ${formatPrice(counterTo.meta?.amount ?? 0)}` : listingPrice ? `İlan fiyatı ${formatPrice(listingPrice)}` : undefined
      }
      footer={
        <Button
          title="Gönder"
          block
          style={styles.flex}
          disabled={value < 1}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onSend(value);
              setAmount('');
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <Input label="Tutar" keyboardType="number-pad" value={amount} onChangeText={(t) => setAmount(maskThousands(t))} suffix="₺" autoFocus placeholder="0" />
      <Text variant="caption" tone="subtle">
        Yeni bir teklif, açıktaki önceki teklifi geri çeker. Teklif bağlayıcı değildir.
      </Text>
    </Sheet>
  );
}

function ReportComposer({ visible, onClose, onSend }: { visible: boolean; onClose: () => void; onSend: (reason: string, details?: string) => Promise<void> }) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Bildir"
      footer={
        <Button
          title="Bildir"
          variant="danger"
          block
          style={styles.flex}
          disabled={!reason}
          loading={busy}
          onPress={async () => {
            if (!reason) return;
            setBusy(true);
            try {
              await onSend(reason, details.trim() || undefined);
              setReason(null);
              setDetails('');
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <View style={styles.chips}>
        {CHAT_REPORT_REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <Input multiline placeholder="Ek açıklama (isteğe bağlı)" value={details} onChangeText={setDetails} maxLength={500} />
    </Sheet>
  );
}

function SearchSheet({ visible, onClose, conversationId, onPick }: { visible: boolean; onClose: () => void; conversationId: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const results = useQuery({ queryKey: ['chatSearch', conversationId, term], queryFn: () => chat.search(conversationId, term), enabled: term.length >= 2 });
  return (
    <Sheet visible={visible} onClose={onClose} title="Sohbette ara" tall>
      <Input
        icon={Search}
        placeholder="En az 2 harf"
        value={q}
        onChangeText={setQ}
        returnKeyType="search"
        onSubmitEditing={() => setTerm(q.trim())}
        autoFocus
      />
      {results.isFetching ? <ActivityIndicator /> : null}
      {results.data?.length === 0 ? (
        <Text tone="muted" center>
          Sonuç yok
        </Text>
      ) : null}
      {results.data?.length ? (
        <RowGroup>
          {results.data.map((r) => (
            <ListRow key={r.id} label={r.content} detail={dayLabel(r.created_at)} onPress={() => onPick(r.id)} />
          ))}
        </RowGroup>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { borderBottomWidth: hairline, paddingBottom: space.sm, gap: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  listing: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.md, padding: space.sm, borderRadius: radius.md },
  listingThumb: { width: 40, height: 40, borderRadius: 8, overflow: 'hidden' },
  list: { paddingVertical: space.md },
  older: { padding: space.md },
  emptyChat: { padding: space.xxl, transform: [{ scaleY: -1 }] },
  day: { alignItems: 'center', marginVertical: space.md },
  dayPill: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill },
  toBottom: {
    position: 'absolute',
    right: space.md,
    bottom: 96,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toBottomBadge: { position: 'absolute', top: -6, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  toBottomText: { color: '#fff', fontWeight: '700' },
  infoPreview: { padding: space.md, borderRadius: radius.md },
  latest: { position: 'absolute', alignSelf: 'center', bottom: 90, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  blocked: { padding: space.lg, gap: space.sm, alignItems: 'center', borderTopWidth: hairline },
  composer: { borderTopWidth: hairline, paddingTop: space.sm, gap: space.sm },
  offerHint: { paddingHorizontal: space.lg },
  quick: { paddingHorizontal: space.md, gap: space.sm },
  replyBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: space.md, paddingLeft: space.md, borderLeftWidth: 3, borderRadius: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, paddingHorizontal: space.sm },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 22, paddingHorizontal: space.md, minHeight: 44 },
  input: { flex: 1, fontSize: font.md, maxHeight: 120, paddingVertical: 10 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

