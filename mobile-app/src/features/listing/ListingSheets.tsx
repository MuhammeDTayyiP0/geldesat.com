import { useState } from 'react';
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
  const send = useMutation({
    mutationFn: (content: string) => chat.start(listing.id, content),
    onSuccess: ({ conversationId }) => {
      setText('');
      onClose();
      void queryClient.invalidateQueries({ queryKey: keys.inbox });
      router.push({ pathname: '/mesaj/[id]', params: { id: conversationId } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
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

/** Opening price offer: starts the chat (if needed) and sends an offer card. */
export function OfferSheet({ listing, visible, onClose }: { listing: Listing; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const value = parseMasked(amount) ?? 0;
  const suggestions = [0.9, 0.85, 0.8].map((r) => Math.round((listing.price * r) / 100) * 100).filter((n) => n > 0);
  const send = useMutation({
    mutationFn: async () => {
      const { conversationId } = await chat.start(listing.id, 'Merhaba, bu ilan için bir teklifim var.');
      await chat.offer(conversationId, value);
      return conversationId;
    },
    onSuccess: (conversationId) => {
      setAmount('');
      onClose();
      toast.success('Teklifiniz gönderildi');
      void queryClient.invalidateQueries({ queryKey: keys.inbox });
      router.push({ pathname: '/mesaj/[id]', params: { id: conversationId } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
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
        suffix="₺"
        autoFocus
        style={styles.amount}
      />
      <View style={styles.chips}>
        {suggestions.map((n) => (
          <Chip key={n} label={formatPrice(n)} selected={value === n} onPress={() => setAmount(maskThousands(String(n)))} />
        ))}
      </View>
      <Text variant="caption" tone="subtle">
        Satıcı teklifinizi kabul edebilir, reddedebilir veya karşı teklif verebilir. Teklif bağlayıcı değildir.
      </Text>
    </Sheet>
  );
}

/** Seller's number after "Telefonu göster": call, WhatsApp, copy. */
export function PhoneSheet({ phone, visible, onClose, sellerName }: { phone: string | null; visible: boolean; onClose: () => void; sellerName?: string }) {
  const digits = cleanPhone(phone);
  const intl = digits.startsWith('0') ? `90${digits.slice(1)}` : digits;
  return (
    <Sheet visible={visible} onClose={onClose} title={sellerName ?? 'Satıcı'} subtitle="İletişim bilgisi">
      <Text variant="title" center selectable>
        {formatPhone(phone)}
      </Text>
      <RowGroup>
        <ListRow icon={Phone} label="Ara" onPress={() => void Linking.openURL(`tel:${digits}`)} />
        <ListRow icon={MessageCircle} label="WhatsApp ile yaz" onPress={() => void Linking.openURL(`https://wa.me/${intl}`)} />
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
  visible,
  onClose,
  existing,
}: {
  listingId: string;
  visible: boolean;
  onClose: () => void;
  existing: { rating: number; comment: string | null } | null;
}) {
  const { c } = useTheme();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const send = useMutation({
    mutationFn: () => listings.review(listingId, rating, comment.trim() || undefined),
    onSuccess: () => {
      toast.success('Değerlendirmeniz kaydedildi');
      void queryClient.invalidateQueries({ queryKey: keys.listing(listingId) });
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
