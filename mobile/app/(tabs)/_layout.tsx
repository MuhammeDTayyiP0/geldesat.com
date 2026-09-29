import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import { AppState, View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Home, Search, Plus, MessageCircle, User, Bell, MapPin, Settings2 } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { LogoMark } from '@/src/components/brand/LogoMark';
import { getStoredUser } from '@/src/api/auth';
import { getMobileConversations, getMobileNotifications } from '@/src/api/client';

import { useRouter } from 'expo-router';

export default function TabLayout() {
  const router = useRouter();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const refreshingBadges = useRef(false);
  const refreshBadges = useCallback(async () => {
    if (AppState.currentState !== 'active' || refreshingBadges.current) return;
    refreshingBadges.current = true;
    try {
    const user = await getStoredUser();
    if (!user?.token) { setUnreadMessages(0); setUnreadNotifications(0); return; }
    const [messages, notifications] = await Promise.allSettled([getMobileConversations(user.token), getMobileNotifications(user.token)]);
    if (messages.status === 'fulfilled') setUnreadMessages(messages.value.conversations.reduce((count, conversation) => count + conversation.unread_count, 0));
    if (notifications.status === 'fulfilled') setUnreadNotifications(notifications.value.unread);
    } finally {
      refreshingBadges.current = false;
    }
  }, []);
  useEffect(() => {
    void refreshBadges();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refreshBadges();
    }, 30_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshBadges();
    });
    return () => { clearInterval(timer); appState.remove(); };
  }, [refreshBadges]);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BrandColors.primary,
        tabBarInactiveTintColor: BrandColors.textSecondary,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#d8dee6',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
        },
        tabBarBackground: () => <View style={styles.opaqueTabBar} />,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#d8dee6',
        },
        headerBackground: () => <View style={styles.opaqueHeader} />,
        headerShadowVisible: false,
      }}>
      {/* 1. Ana Sayfa */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          headerTitle: () => (
            <View style={styles.headerWordmark}>
              <LogoMark size={26} color="#0d1117" />
              <Text style={styles.brandTitle}>GeldeSat</Text>
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginRight: 16 }}>
              <TouchableOpacity onPress={() => router.push('/harita' as any)} accessibilityLabel="Harita" style={styles.headerIconButton}>
                <MapPin size={20} color="#0d1117" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/bildirimler' as any)} accessibilityLabel={unreadNotifications ? `Bildirimler, ${unreadNotifications} okunmamış` : 'Bildirimler'} style={styles.headerIconButton}>
                <Bell size={20} color="#0d1117" />
                {unreadNotifications > 0 ? <View style={styles.notificationDot} /> : null}
              </TouchableOpacity>
            </View>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Home size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />

      {/* 2. Arama */}
      <Tabs.Screen
        name="kategoriler"
        options={{
          title: 'Arama',
          headerTitle: 'İlan Ara & Kategoriler',
          tabBarIcon: ({ color, focused }) => (
            <Search size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />

      {/* 3. İlan Ver (Web'deki gibi ortada havada duran yuvarlak mavi buton) */}
      <Tabs.Screen
        name="ilan-ver"
        options={{
          title: 'İlan Ver',
          headerTitle: 'Ücretsiz İlan Ver',
          tabBarIcon: () => (
            <View style={styles.centerButton}>
              <Plus size={26} color="#ffffff" strokeWidth={2.6} />
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text style={[styles.centerButtonLabel, focused && { color: BrandColors.primary }]}>İlan Ver</Text>
          ),
        }}
      />

      {/* 4. Mesajlar */}
      <Tabs.Screen
        name="mesajlar"
        options={{
          title: 'Mesajlar',
          headerTitle: 'Mesajlarım',
          tabBarIcon: ({ color, focused }) => (
            <MessageCircle size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
          tabBarBadge: unreadMessages > 0 ? (unreadMessages > 99 ? '99+' : unreadMessages) : undefined,
        }}
      />

      {/* 5. Hesabım */}
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Hesabım',
          headerTitle: 'Hesabım',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/ayarlar' as any)}
              accessibilityRole="button"
              accessibilityLabel="Hesap ayarları"
              hitSlop={8}
              style={styles.headerIconButton}>
              <Settings2 size={20} color="#12151c" />
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />

    </Tabs>
  );
}

const styles = StyleSheet.create({
  opaqueTabBar: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
  },
  opaqueHeader: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
  },
  headerWordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  notificationDot: { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: '#b42318', borderWidth: 1, borderColor: '#fff' },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0d1117',
    letterSpacing: -0.5,
  },
  centerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 8 : 4,
  },
  centerButtonLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: BrandColors.primary,
    marginTop: -2,
  },
});
