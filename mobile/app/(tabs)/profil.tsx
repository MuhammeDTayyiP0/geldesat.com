import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, ChevronRight, Heart, LayoutGrid, LogOut, MessageCircle, Star, UserRound } from 'lucide-react-native';
import { AuthGate } from '@/src/components/auth/AuthGate';
import { getStoredUser, mobileSignOut, MobileUser } from '@/src/api/auth';
import { getMobileProfile, MobileProfile } from '@/src/api/client';

export default function ProfileScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<MobileUser | null>(null);
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setLoading(true);
    const user = await getStoredUser();
    setCurrentUser(user);
    if (!user?.token) { setProfile(null); setLoading(false); return; }
    try {
      const response = await getMobileProfile(user.token);
      setProfile(response.profile ?? null);
    } catch { setProfile(null); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void loadUser(); }, [loadUser]));

  const handleSignOut = async () => {
    Alert.alert('Çıkış yap', 'Bu cihazdaki hesabınızdan çıkış yapılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
        await mobileSignOut();
        setCurrentUser(null);
        setProfile(null);
        router.replace('/login' as any);
      } },
    ]);
  };

  return (
    <AuthGate title="Hesabım" subtitle="İlanlarınızı ve hesap bilgilerinizi buradan yönetin.">
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identityCard}>
          <View style={styles.avatar}><UserRound size={26} color="#1a4fd8" /></View>
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={1}>{profile?.display_name || currentUser?.name || 'Hesabım'}</Text>
            <Text style={styles.email} numberOfLines={1}>{currentUser?.email || 'Hesap bilgilerinizi yönetin'}</Text>
          </View>
          {loading ? <ActivityIndicator size="small" color="#1a4fd8" /> : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={styles.statValue}>{loading ? '…' : profile?.active_count ?? 0}</Text><Text style={styles.statLabel}>Yayındaki ilan</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{loading ? '…' : profile?.favorite_count ?? 0}</Text><Text style={styles.statLabel}>Favori ilan</Text></View>
          <View style={styles.statCard}><View style={styles.ratingValue}><Text style={styles.statValue}>{profile?.rating_avg ? profile.rating_avg.toFixed(1) : '—'}</Text><Star size={13} color="#e0a000" /></View><Text style={styles.statLabel}>Satıcı puanı</Text></View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>İlan ve iletişim</Text>
          <MenuRow icon={<LayoutGrid size={19} color="#1a4fd8" />} label="İlanlarım" detail={`${profile?.listing_count ?? 0} ilan`} onPress={() => router.push('/ilanlarim' as any)} />
          <Divider />
          <MenuRow icon={<Heart size={19} color="#1a4fd8" />} label="Favorilerim" onPress={() => router.push('/favoriler' as any)} />
          <Divider />
          <MenuRow icon={<MessageCircle size={19} color="#1a4fd8" />} label="Mesajlarım" onPress={() => router.push('/(tabs)/mesajlar' as any)} />
          <Divider />
          <MenuRow icon={<Bell size={19} color="#1a4fd8" />} label="Bildirimlerim" onPress={() => router.push('/bildirimler' as any)} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Oturum</Text>
          <MenuRow icon={<LogOut size={19} color="#b42318" />} label="Çıkış Yap" destructive onPress={handleSignOut} />
        </View>
      </ScrollView>
    </AuthGate>
  );
}

function MenuRow({ icon, label, detail, destructive, onPress }: { icon: React.ReactNode; label: string; detail?: string; destructive?: boolean; onPress: () => void }) {
  return <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
    {icon}<View style={styles.menuCopy}><Text style={[styles.menuLabel, destructive && styles.destructive]}>{label}</Text>{detail ? <Text style={styles.menuDetail} numberOfLines={1}>{detail}</Text> : null}</View>
    <ChevronRight size={18} color="#8a929e" />
  </TouchableOpacity>;
}
function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f5f8' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  identityCard: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#fff' },
  headerGear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, minWidth: 0, gap: 4 }, name: { color: '#12151c', fontWeight: '700', fontSize: 17 }, email: { color: '#5a6270', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 8 }, statCard: { flex: 1, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#fff', padding: 8 }, statValue: { color: '#12151c', fontSize: 20, fontWeight: '700' }, ratingValue: { flexDirection: 'row', alignItems: 'center', gap: 3 }, statLabel: { color: '#5a6270', fontSize: 10, textAlign: 'center' },
  sectionCard: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#d8dee6', backgroundColor: '#fff' }, sectionTitle: { color: '#12151c', fontSize: 14, fontWeight: '700', paddingTop: 12, paddingBottom: 4 },
  menuRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 }, menuCopy: { flex: 1, minWidth: 0, gap: 3 }, menuLabel: { color: '#12151c', fontSize: 14, fontWeight: '600' }, menuDetail: { color: '#7a8492', fontSize: 11 }, destructive: { color: '#b42318' }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0' },
});
