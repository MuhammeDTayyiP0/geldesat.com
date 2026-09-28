import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Bell, ChevronLeft, ShieldCheck, Tag, MessageCircle, Heart as HeartIcon } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { useFocusEffect } from 'expo-router';
import { getStoredUser } from '@/src/api/auth';
import { getMobileNotifications, markMobileNotificationsRead, MobileNotification } from '@/src/api/client';
import { AuthGate } from '@/src/components/auth/AuthGate';

export default function BildirimlerScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getStoredUser();
      if (!user?.token) {
        setNotifications([]);
        return;
      }
      const response = await getMobileNotifications(user.token);
      setNotifications(response.notifications);
      await markMobileNotificationsRead(user.token);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadNotifications(); }, [loadNotifications]));

  const openNotification = (path: string) => {
    const [pathname, id] = path.split('/').filter(Boolean);
    if (pathname === 'ilan' && id) router.push(`/ilan/${id}` as any);
    else if (pathname === 'mesajlar' && id) router.push(`/mesaj/${id}` as any);
    else if (pathname === 'mesajlar') router.push('/(tabs)/mesajlar' as any);
  };

  return (
    <AuthGate title="Bildirimler" subtitle="Bildirimlerinizi görmek için giriş yapın.">
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: 'Bildirimler',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 10 }}>
              <ChevronLeft size={24} color="#12151c" />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={BrandColors.primary} /></View>
      ) : <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          /* Web Sitesindeki Birebir Boş Bildirimler Kutusu */
          <View style={styles.emptyCard}>
            <Bell size={40} color="#8a929e" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Henüz bildiriminiz yok.</Text>
            <Text style={styles.emptyDesc}>
              İlanlarınızla ilgili gelişmeler ve mesaj bildirimleri burada görünecektir.
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((item) => {
              const IconComp = item.type === 'message' ? MessageCircle : item.type === 'favorite' ? HeartIcon : item.type === 'listing' ? Tag : ShieldCheck;
              return (
                <TouchableOpacity key={item.id} style={styles.notifItem} onPress={() => openNotification(item.link)} activeOpacity={0.75}>
                  <View style={[styles.iconBox, { backgroundColor: item.read ? '#eef1f5' : '#eaf0ff' }]}>
                    <IconComp size={20} color={item.read ? '#5a6270' : '#1a4fd8'} />
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifBody}>{item.body}</Text>
                    <Text style={styles.notifTime}>{new Date(item.created_at).toLocaleDateString('tr-TR')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>}
    </View>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },
  scrollContent: {
    padding: 16,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d8dee6',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#12151c',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#5a6270',
    textAlign: 'center',
    lineHeight: 18,
  },
  notificationsList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    overflow: 'hidden',
  },
  notifItem: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#12151c',
    marginBottom: 2,
  },
  notifBody: {
    fontSize: 12,
    color: '#5a6270',
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 10,
    color: '#8a929e',
    marginTop: 6,
  },
});
