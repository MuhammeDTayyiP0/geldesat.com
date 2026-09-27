import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { User, LayoutGrid, Heart, Store, Bookmark, Shield, LogOut, ChevronRight, LogIn } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { getStoredUser, mobileSignOut, MobileUser } from '@/src/api/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<MobileUser | null>(null);

  const loadUser = useCallback(async () => {
    const user = await getStoredUser();
    setCurrentUser(user);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  const handleSignOut = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          await mobileSignOut();
          setCurrentUser(null);
        },
      },
    ]);
  };

  const handleRequireAuth = (actionName: string) => {
    if (!currentUser) {
      Alert.alert('Giriş Gerekli', `${actionName} için lütfen giriş yapın.`, [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Giriş Yap', onPress: () => router.push('/login' as any) },
      ]);
    } else {
      Alert.alert('Bilgi', `${actionName} ekranı yakında güncellenecektir.`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. Web Sitesindeki Birebir Profil Başlık Kartı */}
      <View style={styles.profileHeaderCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <View style={styles.profileMeta}>
          <Text style={styles.userName}>
            {currentUser?.name || 'GeldeSat Üyesi'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {currentUser?.email || 'Hesabınızı yönetin veya giriş yapın'}
          </Text>
        </View>
        {currentUser ? (
          <TouchableOpacity style={styles.signOutHeaderBtn} onPress={handleSignOut}>
            <LogOut size={16} color="#b42318" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push('/login' as any)}>
            <LogIn size={15} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.signInBtnText}>Giriş</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Web Menüsü: İlanlar & Mağaza */}
      <Text style={styles.sectionHeader}>İlan Yönetimi</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => handleRequireAuth('İlanlarım')}
          activeOpacity={0.7}>
          <View style={styles.menuIconBox}>
            <LayoutGrid size={18} color="#1a4fd8" />
          </View>
          <Text style={styles.menuText}>İlanlarım</Text>
          <ChevronRight size={16} color="#8a929e" />
        </TouchableOpacity>

        <View style={styles.rowDivider} />

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => handleRequireAuth('Favori İlanlarım')}
          activeOpacity={0.7}>
          <View style={styles.menuIconBox}>
            <Heart size={18} color="#b42318" />
          </View>
          <Text style={styles.menuText}>Favori İlanlarım</Text>
          <ChevronRight size={16} color="#8a929e" />
        </TouchableOpacity>

        <View style={styles.rowDivider} />

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => handleRequireAuth('Mağazam')}
          activeOpacity={0.7}>
          <View style={styles.menuIconBox}>
            <Store size={18} color="#1f7a4d" />
          </View>
          <Text style={styles.menuText}>Mağazam</Text>
          <ChevronRight size={16} color="#8a929e" />
        </TouchableOpacity>
      </View>

      {/* 3. Web Menüsü: Aramalar & Ayarlar */}
      <Text style={styles.sectionHeader}>Hesap & Tercihler</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => handleRequireAuth('Kaydedilen Aramalar')}
          activeOpacity={0.7}>
          <View style={styles.menuIconBox}>
            <Bookmark size={18} color="#5a6270" />
          </View>
          <Text style={styles.menuText}>Kaydedilen Aramalar</Text>
          <ChevronRight size={16} color="#8a929e" />
        </TouchableOpacity>

        <View style={styles.rowDivider} />

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => handleRequireAuth('Şifre ve Güvenlik')}
          activeOpacity={0.7}>
          <View style={styles.menuIconBox}>
            <Shield size={18} color="#5a6270" />
          </View>
          <Text style={styles.menuText}>Şifre & Güvenlik</Text>
          <ChevronRight size={16} color="#8a929e" />
        </TouchableOpacity>

        {currentUser && (
          <>
            <View style={styles.rowDivider} />
            <TouchableOpacity style={styles.menuRow} onPress={handleSignOut} activeOpacity={0.7}>
              <View style={styles.menuIconBox}>
                <LogOut size={18} color="#b42318" />
              </View>
              <Text style={[styles.menuText, { color: '#b42318' }]}>Çıkış Yap</Text>
              <ChevronRight size={16} color="#8a929e" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a4fd8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#12151c',
  },
  userEmail: {
    fontSize: 12,
    color: '#5a6270',
    marginTop: 2,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a4fd8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  signInBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  signOutHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5a6270',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee6',
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f5f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#12151c',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginLeft: 60,
  },
});
