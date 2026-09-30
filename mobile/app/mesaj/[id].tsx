import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
  AppState,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { Send, ChevronLeft, ShieldCheck, MoreHorizontal, Flag, Ban, ShieldOff } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { getStoredUser } from '@/src/api/auth';
import { getMobileConversation, MobileConversation, reportMobileListing, sendMobileMessage, setMobileUserBlocked } from '@/src/api/client';
import { AuthGate } from '@/src/components/auth/AuthGate';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_REPLIES = [
  'Merhaba, ilan hâlâ güncel mi?',
  'Fiyatta pazarlık payı var mı?',
  'Nerede buluşabiliriz?',
  'Son fiyatınız nedir?',
];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [thread, setThread] = useState<MobileConversation | null>(null);
  const [loadError, setLoadError] = useState('');
  const [userId, setUserId] = useState('');
  const [inputText, setInputText] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const loadData = React.useCallback(async () => {
    if (!id) return;
    const user = await getStoredUser();
    if (!user?.token) return;
    setUserId(user.id);
    try {
      const response = await getMobileConversation(id, user.token);
      setThread(response.thread);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Mesajlar yüklenemedi.');
    }
  }, [id]);

  useFocusEffect(React.useCallback(() => {
    let focused = true;
    let inFlight = false;
    const poll = async () => {
      if (!focused || inFlight || AppState.currentState !== 'active') return;
      inFlight = true;
      try { await loadData(); } finally { inFlight = false; }
    };
    void poll();
    const timer = setInterval(() => { void poll(); }, 20_000);
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void poll(); });
    return () => { focused = false; clearInterval(timer); appState.remove(); };
  }, [loadData]));

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [thread?.messages]);

  const handleSend = async (contentToSend?: string) => {
    if (thread?.blocked) { Alert.alert('Mesaj gönderilemiyor', 'Bu kullanıcıyla sohbet durdurulmuş.'); return; }
    const text = (contentToSend || inputText).trim();
    if (!text || !id) return;

    setInputText('');
    const user = await getStoredUser();
    if (!user?.token) return;
    try {
      const response = await sendMobileMessage(id, text, user.token);
      setInputText('');
      setThread((current) => current ? { ...current, messages: [...(current.messages || []), response.message] } : current);
    } catch {
      setInputText(text);
    }
  };

  const handleToggleBlock = () => {
    if (!thread?.other_user_id) return;
    const blocked = !thread.blockedByMe;
    Alert.alert(blocked ? 'Kullanıcıyı engelle' : 'Engeli kaldır', blocked ? 'Bu kullanıcı size mesaj gönderemeyecek.' : 'Bu kullanıcıyla yeniden mesajlaşabilirsiniz.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: blocked ? 'Engelle' : 'Engeli Kaldır', style: blocked ? 'destructive' : 'default', onPress: async () => {
        const user = await getStoredUser();
        if (!user?.token) return;
        try {
          await setMobileUserBlocked(thread.other_user_id!, blocked, user.token);
          setThread((current) => current ? { ...current, blocked, blockedByMe: blocked, blockedByOther: false } : current);
        } catch (error) { Alert.alert('İşlem yapılamadı', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.'); }
      } },
    ]);
  };

  const handleReportConversation = async () => {
    if (!thread?.listing_id) return;
    const user = await getStoredUser();
    if (!user?.token) return;
    try {
      await reportMobileListing(thread.listing_id, 'Uygunsuz mesaj', `Konuşma: ${thread.id}`, user.token);
      setActionsOpen(false);
      Alert.alert('Bildirim alındı', 'Konuşmayı inceleyeceğiz. Teşekkür ederiz.');
    } catch (error) { Alert.alert('Bildirim gönderilemedi', error instanceof Error ? error.message : 'Lütfen tekrar deneyin.'); }
  };

  return (
    <AuthGate title="Mesajlaşma" subtitle="Mesajlarınızı görüntülemek için giriş yapın.">
    <KeyboardAvoidingView
      // iOS needs the explicit keyboard inset. Android's window uses adjustResize,
      // so adding KeyboardAvoidingView's height adjustment there resizes twice.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: thread?.other_user_name || 'Mesajlaşma',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 10 }}>
              <ChevronLeft size={24} color="#12151c" />
            </TouchableOpacity>
          ),
          headerRight: () => <TouchableOpacity onPress={() => setActionsOpen(true)} style={styles.headerAction} accessibilityRole="button" accessibilityLabel="Sohbet işlemleri"><MoreHorizontal size={22} color="#12151c" /></TouchableOpacity>,
        }}
      />

      {/* 1. Üst İlan Bilgilendirme Kartı */}
      {thread && (
        <View style={styles.listingSummaryCard}>
          {thread.listing_image ? (
            <Image source={{ uri: thread.listing_image }} style={styles.listingImg} />
          ) : (
            <View style={styles.imgPlaceholder} />
          )}
          <View style={styles.listingMeta}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {thread.listing_title}
            </Text>
            {thread.listing_price ? (
              <Text style={styles.listingPrice}>
                {new Intl.NumberFormat('tr-TR').format(thread.listing_price)} TL
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.viewAdBtn}
            onPress={() => router.push(`/ilan/${thread.listing_id}` as any)}>
            <Text style={styles.viewAdBtnText}>İlana Git</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Güvenlik Notu */}
      <View style={styles.safetyBox}>
        <ShieldCheck size={16} color="#1f7a4d" style={{ marginRight: 6 }} />
        <Text style={styles.safetyText}>
          GeldeSat güvencesiyle iletişimdesiniz. Şüpheli durumlarda para transferi yapmayınız.
        </Text>
      </View>

      {thread?.blocked ? <View style={styles.blockedBanner}><Ban size={16} color="#b42318" /><Text style={styles.blockedText}>{thread.blockedByMe ? 'Bu kullanıcıyı engellediniz.' : 'Bu kullanıcı sizi engellemiş.'} Mesaj gönderilemez.</Text></View> : null}

      {!thread && loadError ? (
        <View style={styles.loadErrorBox}>
          <Text style={styles.loadErrorText}>{loadError}</Text>
          <TouchableOpacity onPress={() => void loadData()} accessibilityRole="button"><Text style={styles.retryText}>Yeniden Dene</Text></TouchableOpacity>
        </View>
      ) : !thread ? <ActivityIndicator style={{ marginVertical: 18 }} color={BrandColors.primary} /> : null}

      {/* 3. Mesajlar Listesi */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messagesScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {(thread?.messages || []).map((msg) => {
          const isMe = msg.sender_id === userId;
          return (
            <View
              key={msg.id}
              style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextOther]}>
                  {msg.content}
                </Text>
                <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther]}>
                  {new Date(msg.created_at).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* 4. Hızlı Cevap Butonları */}
      {!thread?.blocked ? <View style={styles.quickRepliesArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
          {QUICK_REPLIES.map((reply) => (
            <TouchableOpacity
              key={reply}
              style={styles.quickReplyChip}
              onPress={() => handleSend(reply)}>
              <Text style={styles.quickReplyText}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View> : null}

      {/* 5. Alt Mesaj Giriş Barı */}
      {!thread?.blocked ? <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 0 : insets.bottom }]}>
        <TextInput
          placeholder="Mesajınızı yazın..."
          placeholderTextColor="#8a929e"
          value={inputText}
          onChangeText={setInputText}
          multiline
          scrollEnabled
          style={styles.textInput}
          textAlignVertical="center"
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          disabled={!inputText.trim()}
          onPress={() => handleSend()}>
          <Send size={18} color="#ffffff" />
        </TouchableOpacity>
      </View> : null}

      <Modal transparent animationType="slide" visible={actionsOpen} statusBarTranslucent={Platform.OS === 'android'} navigationBarTranslucent={Platform.OS === 'android'} onRequestClose={() => setActionsOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionsOpen(false)}>
          <Pressable style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sohbet işlemleri</Text>
            {thread?.blockedByOther ? <View style={styles.blockedNotice}><Text style={styles.blockedNoticeText}>Karşı kullanıcı mesajlaşmayı engellemiş.</Text></View> : <TouchableOpacity style={styles.sheetAction} onPress={() => { setActionsOpen(false); handleToggleBlock(); }}>{thread?.blockedByMe ? <ShieldOff size={19} color="#1a4fd8" /> : <Ban size={19} color="#b42318" />}<Text style={styles.sheetActionText}>{thread?.blockedByMe ? 'Engeli kaldır' : 'Kullanıcıyı engelle'}</Text></TouchableOpacity>}
            {thread?.listing_id ? <TouchableOpacity style={styles.sheetAction} onPress={() => void handleReportConversation()}><Flag size={19} color="#5a6270" /><Text style={styles.sheetActionText}>Konuşmayı bildir</Text></TouchableOpacity> : null}
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setActionsOpen(false)}><Text style={styles.sheetCancelText}>Kapat</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },
  messageList: { flex: 1 },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  blockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff1f0', borderBottomWidth: 1, borderBottomColor: '#f6c5c0' },
  blockedText: { flex: 1, color: '#9b1c13', fontSize: 12, lineHeight: 17 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,16,28,0.35)' },
  actionSheet: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#fff' },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#cbd2dc', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { color: '#12151c', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  sheetAction: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e7ebf0' },
  sheetActionText: { color: '#12151c', fontSize: 14, fontWeight: '600' },
  sheetCancel: { minHeight: 46, justifyContent: 'center', alignItems: 'center', marginTop: 10, backgroundColor: '#f3f5f8', borderRadius: 10 },
  sheetCancelText: { color: '#12151c', fontWeight: '700' },
  blockedNotice: { paddingVertical: 12 }, blockedNoticeText: { color: '#9b1c13', fontSize: 13 },
  listingSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee6',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  listingImg: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 10,
  },
  imgPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    marginRight: 10,
  },
  listingMeta: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#12151c',
  },
  listingPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a4fd8',
    marginTop: 2,
  },
  viewAdBtn: {
    backgroundColor: '#f3f5f8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d8dee6',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  viewAdBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a4fd8',
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#a7f3d0',
  },
  safetyText: {
    flex: 1,
    fontSize: 11,
    color: '#065f46',
    lineHeight: 15,
  },
  loadErrorBox: { marginHorizontal: 16, marginVertical: 12, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#fecdca', backgroundColor: '#fff7f6', alignItems: 'center', gap: 8 },
  loadErrorText: { color: '#b42318', fontSize: 13, textAlign: 'center' },
  retryText: { color: '#1a4fd8', fontSize: 13, fontWeight: '700', padding: 8 },
  messagesScroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 20,
    gap: 10,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: '#1a4fd8',
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#d8dee6',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: '#ffffff',
  },
  bubbleTextOther: {
    color: '#12151c',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeTextMe: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  timeTextOther: {
    color: '#8a929e',
  },

  // Hızlı Cevaplar
  quickRepliesArea: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#d8dee6',
    paddingVertical: 6,
  },
  quickScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickReplyChip: {
    backgroundColor: '#f3f5f8',
    borderWidth: 1,
    borderColor: '#d8dee6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickReplyText: {
    fontSize: 11,
    color: '#12151c',
    fontWeight: '500',
  },

  // Giriş Barı
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f3f5f8',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8dee6',
    minHeight: 40,
    maxHeight: 112,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#12151c',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a4fd8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
});
