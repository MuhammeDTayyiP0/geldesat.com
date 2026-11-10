import { memo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, CheckCheck, Clock, HandCoins, MapPin, RotateCcw, ShieldAlert } from 'lucide-react-native';
import type { ChatMessage } from '@/api/types';
import { API_BASE_URL, mediaUrl } from '@/lib/config';
import { formatPrice, formatTime } from '@/lib/format';
import { MapThumb } from '@/features/map/MapThumb';
import { Button, Text, radius, space, useTheme } from '@/ui';
import { LISTING_PHOTO_MSG, chatImagePath, linkify, mapsUrl, messageRisk, previewText } from './shared';

type Props = {
  message: ChatMessage;
  mine: boolean;
  showReads: boolean;
  authHeaders: Record<string, string>;
  /** Grouped with the previous message from the same sender (tighter spacing). */
  grouped: boolean;
  highlighted?: boolean;
  onLongPress: (m: ChatMessage) => void;
  /** Own messages: sent and read times (also offered to screen readers). */
  onInfo?: (m: ChatMessage) => void;
  /** A message that failed to send (sohbet_v2). */
  onRetry?: (m: ChatMessage) => void;
  onOpenImage: (path: string) => void;
  onQuotePress: (id: string) => void;
  onOffer: (m: ChatMessage, action: 'accept' | 'reject' | 'counter') => void;
  otherName: string;
  listingImage: string | null;
};

const OFFER_STATUS: Record<string, { label: string; tone: 'ok' | 'danger' | 'muted' | 'primary' }> = {
  pending: { label: 'Yanıt bekleniyor', tone: 'primary' },
  accepted: { label: 'Kabul edildi', tone: 'ok' },
  rejected: { label: 'Reddedildi', tone: 'danger' },
  withdrawn: { label: 'Geri çekildi', tone: 'muted' },
  countered: { label: 'Karşı teklif verildi', tone: 'muted' },
};

export const Bubble = memo(function Bubble({
  message: m,
  mine,
  showReads,
  authHeaders,
  grouped,
  highlighted,
  onLongPress,
  onInfo,
  onRetry,
  onOpenImage,
  onQuotePress,
  onOffer,
  otherName,
  listingImage,
}: Props) {
  const { c } = useTheme();
  const bg = mine ? c.bubbleMine : c.bubbleOther;
  const fg = mine ? c.bubbleMineText : c.fg;
  const sub = mine ? 'rgba(255,255,255,0.75)' : c.subtle;
  const risk = !mine && !m.deleted && m.kind === 'text' ? messageRisk(m.content) : null;

  const ticks =
    m.pending === 'sending' ? (
      <Clock size={13} color={sub} />
    ) : mine && showReads ? (
      m.read_at ? <CheckCheck size={14} color={mine ? '#9fd0ff' : c.primary} /> : <Check size={14} color={sub} />
    ) : null;
  // Inner buttons (photo, place, quote) pass a long press on, so the menu opens from anywhere on the bubble.
  const longPress = () => !m.deleted && onLongPress(m);

  const footer = (
    <View style={styles.footer}>
      <Text variant="small" style={{ color: sub }}>
        {formatTime(m.created_at)}
      </Text>
      {ticks}
    </View>
  );

  let body: React.ReactNode;
  if (m.deleted) {
    body = (
      <Text variant="caption" style={[styles.deleted, { color: sub }]}>
        {m.content}
      </Text>
    );
  } else if (m.content === LISTING_PHOTO_MSG) {
    body = listingImage ? (
      <Image source={mediaUrl(listingImage, 480)} style={styles.image} contentFit="cover" accessibilityLabel="İlan fotoğrafı" />
    ) : (
      <Text style={{ color: fg }}>📷 İlan fotoğrafı</Text>
    );
  } else if (m.kind === 'image' && m.meta?.image_id) {
    const path = chatImagePath(m.meta.image_id);
    body = (
      <Pressable onPress={() => onOpenImage(path)} onLongPress={longPress} delayLongPress={280} accessibilityRole="imagebutton" accessibilityLabel="Fotoğrafı büyüt">
        <Image source={{ uri: `${API_BASE_URL}${path}`, headers: authHeaders }} style={styles.image} contentFit="cover" transition={150} />
      </Pressable>
    );
  } else if (m.kind === 'offer' && m.meta?.amount != null) {
    const status = OFFER_STATUS[m.meta.status ?? 'pending'] ?? OFFER_STATUS.pending;
    const pending = m.meta.status === 'pending';
    body = (
      <View style={[styles.offer, { backgroundColor: mine ? 'rgba(255,255,255,0.12)' : c.primarySoft }]}>
        <View style={styles.offerHead}>
          <HandCoins size={18} color={mine ? '#fff' : c.primary} />
          <Text variant="label" style={{ color: mine ? '#fff' : c.primary }}>
            {m.meta.counter ? 'Karşı teklif' : 'Teklif'}
          </Text>
        </View>
        <Text variant="title" style={{ color: fg }}>
          {formatPrice(m.meta.amount)}
        </Text>
        {/* On your own (blue) bubble green and red were unreadable: white there. */}
        <Text variant="small" style={{ color: mine ? '#ffffff' : status.tone === 'ok' ? c.ok : status.tone === 'danger' ? c.danger : sub, fontWeight: '700' }}>
          {status.label}
        </Text>
        {!mine && pending ? (
          <View style={styles.offerActions}>
            <Button title="Kabul et" size="sm" onPress={() => onOffer(m, 'accept')} style={styles.flex} />
            <Button title="Reddet" size="sm" variant="outline" onPress={() => onOffer(m, 'reject')} style={styles.flex} />
            <Button title="Karşı teklif" size="sm" variant="ghost" onPress={() => onOffer(m, 'counter')} />
          </View>
        ) : null}
      </View>
    );
  } else if (m.kind === 'location') {
    const lat = m.meta?.lat;
    const lng = m.meta?.lng;
    body = (
      <Pressable
        onPress={() => void Linking.openURL(mapsUrl(m.meta ?? {}))}
        onLongPress={longPress}
        delayLongPress={280}
        style={styles.location} accessibilityRole="link" accessibilityLabel={`Konum: ${m.meta?.label ?? m.content}. Haritada aç`}>
        {lat != null && lng != null ? (
          <MapThumb lat={lat} lng={lng} width={232} height={136} />
        ) : (
          <View style={[styles.pin, { backgroundColor: mine ? 'rgba(255,255,255,0.18)' : c.primarySoft }]}>
            <MapPin size={22} color={mine ? '#fff' : c.primary} />
          </View>
        )}
        <View style={styles.locationText}>
          <Text variant="label" style={{ color: fg }} numberOfLines={2}>
            {m.meta?.label ?? m.content}
          </Text>
          <Text variant="small" style={{ color: mine ? '#fff' : c.primary, fontWeight: '700' }}>
            Haritada aç
          </Text>
        </View>
      </Pressable>
    );
  } else {
    body = (
      <Text selectable={false} style={{ color: fg }}>
        {linkify(m.content).map((part, i) =>
          part.href ? (
            <Text key={i} style={[styles.link, { color: mine ? '#fff' : c.primary }]} onPress={() => void Linking.openURL(part.href ?? '')}>
              {part.text}
            </Text>
          ) : (
            <Text key={i} style={{ color: fg }}>
              {part.text}
            </Text>
          ),
        )}
      </Text>
    );
  }

  return (
    <View style={[styles.wrap, mine ? styles.right : styles.left, { marginTop: grouped ? 2 : space.sm }]}>
      <Pressable
        onLongPress={longPress}
        delayLongPress={280}
        accessible
        accessibilityLabel={`${mine ? 'Siz' : otherName}: ${previewText(m.kind, m.content, m.deleted)}, ${formatTime(m.created_at)}${
          m.pending === 'sending' ? ', gönderiliyor' : m.pending === 'failed' ? ', gönderilemedi' : mine && showReads && m.read_at ? ', okundu' : ''
        }`}
        accessibilityActions={
          m.deleted
            ? undefined
            : [{ name: 'longpress', label: 'Mesaj seçenekleri' }, ...(mine && onInfo ? [{ name: 'info', label: 'Mesaj bilgisi' }] : [])]
        }
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') longPress();
          else if (e.nativeEvent.actionName === 'info') onInfo?.(m);
        }}
        style={[
          styles.bubble,
          { backgroundColor: bg, borderColor: c.border },
          !mine && styles.bubbleOther,
          mine ? styles.mineCorner : styles.otherCorner,
          (m.kind === 'image' || m.content === LISTING_PHOTO_MSG) && !m.deleted && styles.mediaBubble,
          highlighted && { borderColor: c.warn, borderWidth: 2 },
        ]}
      >
        {m.reply && !m.deleted ? (
          <Pressable
            onPress={() => m.reply && onQuotePress(m.reply.id)}
            onLongPress={longPress}
            delayLongPress={280}
            style={[styles.quote, { backgroundColor: mine ? 'rgba(255,255,255,0.15)' : c.elevated, borderLeftColor: mine ? '#fff' : c.primary }]}
          >
            <Text variant="small" style={{ color: mine ? '#fff' : c.primary, fontWeight: '700' }}>
              {m.reply.sender_id === m.sender_id ? (mine ? 'Siz' : otherName) : mine ? otherName : 'Siz'}
            </Text>
            <Text variant="caption" numberOfLines={2} style={{ color: sub }}>
              {previewText(m.reply.kind, m.reply.content, false)}
            </Text>
          </Pressable>
        ) : null}
        {body}
        {footer}
      </Pressable>
      {m.pending === 'failed' ? (
        <Pressable accessibilityRole="button" onPress={() => onRetry?.(m)} style={styles.failed} hitSlop={6}>
          <RotateCcw size={13} color={c.danger} />
          <Text variant="small" tone="danger">
            Gönderilemedi · tekrar dene
          </Text>
        </Pressable>
      ) : null}
      {risk ? (
        <View style={[styles.risk, { backgroundColor: c.warnSoft }]}>
          <ShieldAlert size={14} color={c.warn} />
          <Text variant="small" tone="warn" style={styles.flex}>
            {risk}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Close to the screen edge on your side, a clear gap on the other (as in WhatsApp).
  wrap: { maxWidth: '78%', paddingHorizontal: space.sm },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  left: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: 6, gap: 4, minWidth: 72 },
  bubbleOther: { borderWidth: StyleSheet.hairlineWidth },
  mineCorner: { borderBottomRightRadius: 6 },
  otherCorner: { borderBottomLeftRadius: 6 },
  mediaBubble: { padding: 4, paddingBottom: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', paddingHorizontal: 4 },
  deleted: { fontStyle: 'italic' },
  image: { width: 220, height: 220, borderRadius: 14 },
  offer: { borderRadius: radius.md, padding: space.md, gap: 4, minWidth: 210 },
  offerHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  offerActions: { flexDirection: 'row', gap: space.xs, marginTop: space.sm, flexWrap: 'wrap' },
  location: { gap: space.xs, width: 232, marginHorizontal: -space.sm + 2, marginTop: -2 },
  locationText: { paddingHorizontal: space.xs, gap: 2 },
  pin: { height: 96, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  link: { textDecorationLine: 'underline' },
  quote: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: space.sm, paddingVertical: 4 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 4 },
  risk: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: 8 },
});
