import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Home, Search, Plus, MessageCircle, User, Bell } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { LogoMark } from '@/src/components/brand/LogoMark';

import { useRouter } from 'expo-router';

export default function TabLayout() {
  const router = useRouter();
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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#d8dee6',
        },
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
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={() => router.push('/bildirimler' as any)}>
              <Bell size={20} color="#0d1117" />
            </TouchableOpacity>
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
        }}
      />

      {/* 5. Hesabım */}
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Hesabım',
          headerTitle: 'Hesabım',
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />

      {/* Eski template sekmesi */}
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerWordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0d1117',
    letterSpacing: -0.5,
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BrandColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 14 : 16,
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  centerButtonLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: BrandColors.primary,
    marginTop: -2,
  },
});
