import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Copy, Flag, MessageCircle, Phone } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { chat, listings } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { Listing } from '@/api/types';
import { BUYER_QUICK_REPLIES, REPORT_REASONS } from '@/features/chat/shared';
import { cleanPhone, formatPhone, formatPrice, maskThousands, parseMasked } from '@/lib/format';
import { Button, Chip, Input, ListRow, RowGroup, Sheet, Stars, Text, space, toast, useTheme } from '@/ui';

/** First message to the seller, with one-tap quick replies. */
export function MessageSheet({ listing, visible, onClose }: { listing: Listing; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const pendingConv = useRef<string | null>(null);
  const send = useMutation({
    mutationFn: (content: string) => chat.start(listing.id, { content }),
    onSuccess: ({ conversationId }) => {
      setText('');
      pendingConv.current = conversationId;
      void queryClient.invalidateQueries({ queryKey: keys.inbox });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismissed={() => {
        const cid = pendingConv.current;
        pendingConv.current = null;
        if (cid) router.push({ pathname: '/mesaj/[id]', params: { id: cid } });
      }}
      title="Satıcıya mesaj"
      subtitle={listing.title}
      footer={
        <Button
          title="Gönder"
          icon={MessageCircle}
          block
          style={styles.flex}
          loading={send.isPending}
          disabled={!text.trim()}
          onPress={() => send.mutate(text.trim())}
        />
      }
    >
      <View style={styles.chips}>
        {BUYER_QUICK_REPLIES.map((q) => (
          <Chip key={q} label={q} selected={text === q} onPress={() => setText(q)} />
        ))}
      </View>
      <Input multiline placeholder="Mesajınızı yazın" value={text} onChangeText={setText} maxLength={2000} />
      <Text variant="caption" tone="subtle">
        Güvenliğiniz için ürünü görmeden ödeme yapmayın ve yazışmaları GeldeSat üzerinde tutun.
      </Text>
    </Sheet>
  );
}

function roundOfferSuggestion(raw: number): number {
  if (raw >= 1000) return Math.round(raw / 100) * 100;
  if (raw >= 100) return Math.round(raw / 10) * 10;
  return Math.round(raw);
}

function suggestedOffers(price: number): { percent: number; amount: number }[] {
  if (!price || price <= 0) return [];
  const seen = new Set<number>();
  const chips: { percent: number; amount: number }[] = [];
  for (const percent of [5, 10, 15]) {
    const amount = roundOfferSuggestion((price * (100 - percent)) / 100);
    if (amount > 0 && amount < price && !seen.has(amount)) {
      seen.add(amount);
      chips.push({ percent, amount });
    }
  }
  return chips;
}

/** Opening price offer: starts the chat (if needed) and sends an offer card. */
export function OfferSheet({ listing, visible, onClose }: { listing: Listing; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const pendingConv = useRef<string | null>(null);
  const value = parseMasked(amount) ?? 0;
  const suggestions = suggestedOffers(listing.price);
  const currencySuffix = listing.currency === 'USD' ? '$' : listing.currency === 'EUR' ? '€' : '₺';
  const send = useMutation({
    // One call: the offer card opens the chat, so no filler message, and a retry cannot send two.
    mutationFn: async () => (await chat.start(listing.id, { offer: value })).conversationId,
    onSuccess: (conversationId) => {
      setAmount('');
      pendingConv.current = conversationId;
      toast.success('Teklifiniz gönderildi');
      void queryClient.invalidateQueries({ queryKey: keys.inbox });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismissed={() => {
        const cid = pendingConv.current;
        pendingConv.current = null;
        if (cid) router.push({ pathname: '/mesaj/[id]', params: { id: cid } });
      }}
      title="Teklif ver"
      subtitle={`İlan fiyatı ${formatPrice(listing.price, listing.currency)}`}
      footer={<Button title="Teklifi gönder" block style={styles.flex} loading={send.isPending} disabled={value < 1} onPress={() => send.mutate()} />}
    >
      <Input
        label="Teklifiniz"
        keyboardType="number-pad"
        placeholder="0"
        value={amount}
        onChangeText={(t) => setAmount(maskThousands(t))}
        suffix={currencySuffix}
        autoFocus
        style={styles.amount}
      />
      <View style={styles.chips}>
        {suggestions.map((s) => (
          <Chip key={s.amount} label={`%${s.percent} · ${formatPrice(s.amount, listing.currency)}`} selected={value === s.amount} onPress={() => setAmount(maskThousands(String(s.amount)))} />
        ))}
      </View>
      <Text variant="caption" tone="subtle">
        Satıcı teklifinizi kabul edebilir, reddedebilir veya karşı teklif verebilir. Teklif bağlayıcı değildir.
      </Text>
    </Sheet>
  );
}

/** Seller's number after "Telefonu göster": call, WhatsApp, copy. */
export function PhoneSheet({
  phone,
  visible,
  onClose,
  sellerName,
  listingTitle,
  whatsapp = true,
}: {
  phone: string | null;
  visible: boolean;
  onClose: () => void;
  sellerName?: string;
  listingTitle?: string;
  /** The seller's "WhatsApp'tan yazılabilsin" setting. */
  whatsapp?: boolean;
}) {
  const digits = cleanPhone(phone);
  const ten = digits.replace(/^0/, '');
  const canWhatsapp = whatsapp && /^5\d{9}$/.test(ten);
  const whatsappUrl = canWhatsapp
    ? listingTitle
      ? `https://wa.me/90${ten}?text=${encodeURIComponent(`Merhaba, GeldeSat'taki “${listingTitle}” ilanınız hakkında yazıyorum.`)}`
      : `https://wa.me/90${ten}`
    : null;
  return (
    <Sheet visible={visible} onClose={onClose} title={sellerName ?? 'Satıcı'} subtitle="İletişim bilgisi">
      <Text variant="title" center selectable>
        {formatPhone(phone)}
      </Text>
      <RowGroup>
        <ListRow icon={Phone} label="Ara" onPress={() => void Linking.openURL(`tel:${digits}`)} />
        {whatsappUrl ? <ListRow icon={MessageCircle} label="WhatsApp ile yaz" onPress={() => void Linking.openURL(whatsappUrl)} /> : null}
        <ListRow
          icon={Copy}
          label="Numarayı kopyala"
          onPress={() => {
            void Clipboard.setStringAsync(digits);
            toast.success('Numara kopyalandı');
          }}
        />
      </RowGroup>
      <Text variant="caption" tone="subtle" center>
        Aradığınızda GeldeSat’ta gördüğünüzü belirtin. Kapora veya ön ödeme istenirse dikkatli olun.
      </Text>
    </Sheet>
  );
}

export function ReportSheet({ listingId, visible, onClose }: { listingId: string; visible: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const send = useMutation({
    mutationFn: () => listings.report(listingId, reason ?? '', details.trim() || undefined),
    onSuccess: () => {
      toast.success('Bildiriminiz alındı. Teşekkürler.');
      setReason(null);
      setDetails('');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="İlanı bildir"
      footer={<Button title="Bildir" icon={Flag} variant="danger" block style={styles.flex} disabled={!reason} loading={send.isPending} onPress={() => send.mutate()} />}
    >
      <View style={styles.chips}>
        {REPORT_REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <Input multiline placeholder="Ek açıklama (isteğe bağlı)" value={details} onChangeText={setDetails} maxLength={500} />
    </Sheet>
  );
}

export function ReviewSheet({
  listingId,
  sellerId,
  visible,
  onClose,
  existing,
}: {
  listingId: string;
  sellerId?: string;
  visible: boolean;
  onClose: () => void;
  existing: { rating: number; comment: string | null } | null;
}) {
  const { c } = useTheme();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevExisting, setPrevExisting] = useState(existing);
  if (visible !== prevVisible || existing !== prevExisting) {
    setPrevVisible(visible);
    setPrevExisting(existing);
    if (visible) {
      setRating(existing?.rating ?? 0);
      setComment(existing?.comment ?? '');
    }
  }
  const send = useMutation({
    mutationFn: () => listings.review(listingId, rating, comment.trim() || undefined),
    onSuccess: () => {
      toast.success('Değerlendirmeniz kaydedildi');
      // Every open copy of the listing (by id, address or number) and the seller page show the rating.
      void queryClient.invalidateQueries({ queryKey: ['listing'] });
      if (sellerId) void queryClient.invalidateQueries({ queryKey: keys.seller(sellerId) });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Satıcıyı değerlendir"
      footer={<Button title="Kaydet" block style={styles.flex} disabled={rating < 1} loading={send.isPending} onPress={() => send.mutate()} />}
    >
      <View style={[styles.stars, { backgroundColor: c.elevated }]}>
        <Stars value={rating} size={34} onChange={setRating} />
      </View>
      <Input multiline placeholder="Alışveriş deneyiminizi anlatın (isteğe bağlı)" value={comment} onChangeText={setComment} maxLength={400} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  amount: { fontSize: 22, fontWeight: '700' },
  stars: { alignItems: 'center', paddingVertical: space.lg, borderRadius: 14 },
});
