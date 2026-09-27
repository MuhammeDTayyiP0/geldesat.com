import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { MessageCircle, Search } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';

export default function MessagesScreen() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  return (
    <View style={styles.container}>
      {/* 1. Web Sitesindeki Arama ve Filtre Çubuğu */}
      <View style={styles.headerArea}>
        <View style={styles.searchBox}>
          <Search size={16} color="#8a929e" style={{ marginRight: 6 }} />
          <TextInput
            placeholder="Mesajlarda ara..."
            placeholderTextColor="#8a929e"
            value={q}
            onChangeText={setQ}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.tabBtn, filter === 'all' && styles.tabBtnActive]}
            onPress={() => setFilter('all')}>
            <Text style={[styles.tabBtnText, filter === 'all' && styles.tabBtnTextActive]}>Tümü</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, filter === 'unread' && styles.tabBtnActive]}
            onPress={() => setFilter('unread')}>
            <Text style={[styles.tabBtnText, filter === 'unread' && styles.tabBtnTextActive]}>Okunmamış</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Web Sitesindeki Birebir Boş Durum Kutusu */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.emptyCard}>
          <View style={styles.iconCircle}>
            <MessageCircle size={28} color="#8a929e" />
          </View>
          <Text style={styles.emptyTitle}>Henüz mesajınız yok</Text>
          <Text style={styles.emptyDesc}>
            İlan sahipleriyle iletişime geçtiğinizde veya ilanlarınıza soru sorulduğunda mesajlarınız burada listelenir.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8', // Web: --color-bg
  },
  headerArea: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee6',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f5f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee6',
    height: 40,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#12151c',
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f3f5f8',
  },
  tabBtnActive: {
    backgroundColor: '#0d1117', // Web: bg-ink
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5a6270',
  },
  tabBtnTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d8dee6',
    padding: 32,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f5f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
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
});
