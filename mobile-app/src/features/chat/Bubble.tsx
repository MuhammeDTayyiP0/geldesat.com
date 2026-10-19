import { memo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, CheckCheck, HandCoins, MapPin, ShieldAlert } from 'lucide-react-native';
import type { ChatMessage } from '@/api/types';
import { API_BASE_URL, mediaUrl } from '@/lib/config';
import { formatPrice, formatTime } from '@/lib/format';
import { Button, Text, radius, space, useTheme } from '@/ui';
import { LISTING_PHOTO_MSG, chatImagePath, linkify, mapsUrl, messageRisk } from './shared';

type Props = {
  message: ChatMessage;
  mine: boolean;
  showReads: boolean;
  authHeaders: Record<string, string>;
  /** Grouped with the previous message from the same sender (tighter spacing). */
  grouped: boolean;
  highlighted?: boolean;
  onLongPress: (m: ChatMessage) => void;
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

  const ticks = mine && showReads ? (
    m.read_at ? <CheckCheck size={14} color={mine ? '#9fd0ff' : c.primary} /> : <Check size={14} color={sub} />
  ) : null;

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
  } else if (m.content === LISTING_PHOTO_MSG && listingImage) {
    body = <Image source={mediaUrl(listingImage, 480)} style={styles.image} contentFit="cover" />;
  } else if (m.kind === 'image' && m.meta?.image_id) {
    const path = chatImagePath(m.meta.image_id);
    body = (
      <Pressable onPress={() => onOpenImage(path)} accessibilityRole="imagebutton" accessibilityLabel="Fotoğrafı büyüt">
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
        <Text variant="small" style={{ color: status.tone === 'ok' ? c.ok : status.tone === 'danger' ? c.danger : sub, fontWeight: '700' }}>
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
    body = (
      <Pressable onPress={() => void Linking.openURL(mapsUrl(m.meta ?? {}))} style={styles.location} accessibilityRole="link">
        <View style={[styles.pin, { backgroundColor: mine ? 'rgba(255,255,255,0.18)' : c.primarySoft }]}>
          <MapPin size={20} color={mine ? '#fff' : c.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="label" style={{ color: fg }}>
            Buluşma noktası
          </Text>
          <Text variant="caption" style={{ color: sub }} numberOfLines={2}>
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
        onLongPress={() => !m.deleted && onLongPress(m)}
        delayLongPress={280}
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
            style={[styles.quote, { backgroundColor: mine ? 'rgba(255,255,255,0.15)' : c.elevated, borderLeftColor: mine ? '#fff' : c.primary }]}
          >
            <Text variant="small" style={{ color: mine ? '#fff' : c.primary, fontWeight: '700' }}>
              {m.reply.sender_id === m.sender_id ? (mine ? 'Siz' : otherName) : mine ? otherName : 'Siz'}
            </Text>
            <Text variant="caption" numberOfLines={2} style={{ color: sub }}>
              {m.reply.kind === 'image' ? '📷 Fotoğraf' : m.reply.content}
            </Text>
          </Pressable>
        ) : null}
        {body}
        {footer}
      </Pressable>
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
  wrap: { maxWidth: '82%', paddingHorizontal: space.md },
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
  location: { flexDirection: 'row', gap: space.sm, alignItems: 'center', minWidth: 210 },
  pin: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  link: { textDecorationLine: 'underline' },
  quote: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: space.sm, paddingVertical: 4 },
  risk: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: 8 },
});
