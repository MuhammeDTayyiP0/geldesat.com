import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Bell, ChevronLeft, ShieldCheck, Tag } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';

const SAMPLE_NOTIFICATIONS = [
  {
    id: 'n1',
    title: 'GeldeSat Mobil Uygulamasına Hoş Geldiniz!',
    body: 'Türkiye genelinde yüz binlerce emlak, vasıta ve ikinci el ilanını ücretsiz keşfedebilir veya saniyeler içinde ilan verebilirsiniz.',
    time: 'Bugün',
    icon: ShieldCheck,
    color: '#1a4fd8',
  },
  {
    id: 'n2',
    title: 'Ücretsiz İlan Verme Fırsatı',
    body: 'Satmak istediğiniz ürün veya aracın fotoğraflarını çekip hemen vitrine koyun.',
    time: 'Dün',
    icon: Tag,
    color: '#1f7a4d',
  },
];

export default function BildirimlerScreen() {
  const router = useRouter();

  return (
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {SAMPLE_NOTIFICATIONS.length === 0 ? (
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
            {SAMPLE_NOTIFICATIONS.map((item) => {
              const IconComp = item.icon;
              return (
                <View key={item.id} style={styles.notifItem}>
                  <View style={[styles.iconBox, { backgroundColor: item.color + '15' }]}>
                    <IconComp size={20} color={item.color} />
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifBody}>{item.body}</Text>
                    <Text style={styles.notifTime}>{item.time}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
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
