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
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { Send, ChevronLeft, ShieldCheck, User } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { getStoredUser } from '@/src/api/auth';
import { getMobileConversation, MobileConversation, sendMobileMessage } from '@/src/api/client';
import { AuthGate } from '@/src/components/auth/AuthGate';

const QUICK_REPLIES = [
  'Merhaba, ilan hâlâ güncel mi?',
  'Fiyatta pazarlık payı var mı?',
  'Nerede buluşabiliriz?',
  'Son fiyatınız nedir?',
];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [thread, setThread] = useState<MobileConversation | null>(null);
  const [userId, setUserId] = useState('');
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const loadData = async () => {
    if (!id) return;
    const user = await getStoredUser();
    if (!user?.token) return;
    setUserId(user.id);
    try {
      const response = await getMobileConversation(id, user.token);
      setThread(response.thread);
    } catch {
      setThread(null);
    }
  };

  useFocusEffect(React.useCallback(() => {
    void loadData();
    const timer = setInterval(() => { void loadData(); }, 12_000);
    return () => clearInterval(timer);
  }, [id]));

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [thread?.messages]);

  const handleSend = async (contentToSend?: string) => {
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

  return (
    <AuthGate title="Mesajlaşma" subtitle="Mesajlarınızı görüntülemek için giriş yapın.">
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: thread?.other_user_name || 'Mesajlaşma',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 10 }}>
              <ChevronLeft size={24} color="#12151c" />
            </TouchableOpacity>
          ),
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

      {/* 3. Mesajlar Listesi */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.messagesScroll}
        showsVerticalScrollIndicator={false}>
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
      <View style={styles.quickRepliesArea}>
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
      </View>

      {/* 5. Alt Mesaj Giriş Barı */}
      <View style={styles.inputBar}>
        <TextInput
          placeholder="Mesajınızı yazın..."
          placeholderTextColor="#8a929e"
          value={inputText}
          onChangeText={setInputText}
          style={styles.textInput}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          disabled={!inputText.trim()}
          onPress={() => handleSend()}>
          <Send size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },
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
  messagesScroll: {
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
    height: 40,
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
