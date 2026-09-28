import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Modal, ScrollView, TouchableOpacity, TextInput, Switch, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, RotateCcw, Check, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { MobileAttribute } from '@/src/api/client';
import { TURKEY_CITIES } from '@/src/data/locations';

export interface FilterState {
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  minKm?: string;
  maxKm?: string;
  minM2?: string;
  maxM2?: string;
  attrs?: Record<string, string[]>;
  isUrgentOnly?: boolean;
  city?: string;
  district?: string;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters?: FilterState;
  showVehicleFilters?: boolean;
  showPropertyFilters?: boolean;
  attributes?: MobileAttribute[];
}

export function FilterModal({ visible, onClose, onApply, initialFilters = {}, showVehicleFilters = false, showPropertyFilters = false, attributes = [] }: FilterModalProps) {
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice || '');
  const [minYear, setMinYear] = useState(initialFilters.minYear || '');
  const [maxYear, setMaxYear] = useState(initialFilters.maxYear || '');
  const [minKm, setMinKm] = useState(initialFilters.minKm || '');
  const [maxKm, setMaxKm] = useState(initialFilters.maxKm || '');
  const [minM2, setMinM2] = useState(initialFilters.minM2 || '');
  const [maxM2, setMaxM2] = useState(initialFilters.maxM2 || '');
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string[]>>(initialFilters.attrs || {});
  const [isUrgentOnly, setIsUrgentOnly] = useState(initialFilters.isUrgentOnly || false);
  const [city, setCity] = useState(initialFilters.city || '');
  const [district, setDistrict] = useState(initialFilters.district || '');
  const [locationMode, setLocationMode] = useState<'city' | 'district' | null>(null);
  const [locationSearch, setLocationSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMinPrice(initialFilters.minPrice || ''); setMaxPrice(initialFilters.maxPrice || '');
    setMinYear(initialFilters.minYear || ''); setMaxYear(initialFilters.maxYear || '');
    setMinKm(initialFilters.minKm || ''); setMaxKm(initialFilters.maxKm || '');
    setMinM2(initialFilters.minM2 || ''); setMaxM2(initialFilters.maxM2 || '');
    setSelectedAttrs(initialFilters.attrs || {});
    setIsUrgentOnly(initialFilters.isUrgentOnly || false); setCity(initialFilters.city || '');
    setDistrict(initialFilters.district || '');
    setLocationMode(null); setLocationSearch('');
  }, [visible, initialFilters]);

  const handleReset = () => {
    setMinPrice('');
    setMaxPrice('');
    setMinYear('');
    setMaxYear('');
    setMinKm(''); setMaxKm(''); setMinM2(''); setMaxM2('');
    setSelectedAttrs({});
    setIsUrgentOnly(false);
    setCity('');
    setDistrict('');
  };

  const handleApply = () => {
    onApply({
      minPrice: minPrice.trim() || undefined,
      maxPrice: maxPrice.trim() || undefined,
      minYear: minYear.trim() || undefined,
      maxYear: maxYear.trim() || undefined,
      minKm: minKm.trim() || undefined,
      maxKm: maxKm.trim() || undefined,
      minM2: minM2.trim() || undefined,
      maxM2: maxM2.trim() || undefined,
      attrs: selectedAttrs,
      isUrgentOnly,
      city: city.trim() || undefined,
      district: district.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Başlık Barı */}
        <View style={styles.header}>
          {locationMode ? <TouchableOpacity onPress={() => { setLocationMode(null); setLocationSearch(''); }} style={styles.iconButton}><ChevronLeft size={22} color={BrandColors.text} /></TouchableOpacity> : <TouchableOpacity onPress={onClose} style={styles.iconButton}><X size={22} color={BrandColors.text} /></TouchableOpacity>}
          <Text style={styles.headerTitle}>{locationMode === 'city' ? 'İl seç' : locationMode === 'district' ? 'İlçe seç' : 'Filtreler'}</Text>
          {locationMode ? <View style={styles.iconButton} /> : <TouchableOpacity onPress={handleReset} style={styles.resetButton}><RotateCcw size={15} color={BrandColors.danger} style={{ marginRight: 4 }} /><Text style={styles.resetText}>Temizle</Text></TouchableOpacity>}
        </View>

        {locationMode ? <View style={styles.locationPicker}>
          <View style={styles.locationSearch}><Search size={17} color={BrandColors.textMuted} /><TextInput value={locationSearch} onChangeText={setLocationSearch} placeholder={locationMode === 'city' ? 'İl ara' : 'İlçe ara'} placeholderTextColor={BrandColors.textMuted} style={styles.locationSearchInput} autoFocus /></View>
          <FlatList
            data={(locationMode === 'city' ? TURKEY_CITIES.map((item) => item.name) : (TURKEY_CITIES.find((item) => item.name === city)?.districts ?? [])).filter((name) => name.toLocaleLowerCase('tr').includes(locationSearch.trim().toLocaleLowerCase('tr')))}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={locationMode === 'district' ? <TouchableOpacity style={styles.locationRow} onPress={() => { setDistrict(''); setLocationMode(null); setLocationSearch(''); }}><Text style={styles.locationRowText}>Tüm ilçeler</Text></TouchableOpacity> : <TouchableOpacity style={styles.locationRow} onPress={() => { setCity(''); setDistrict(''); setLocationMode(null); setLocationSearch(''); }}><Text style={styles.locationRowText}>Tüm iller</Text></TouchableOpacity>}
            renderItem={({ item }) => <TouchableOpacity style={styles.locationRow} onPress={() => { if (locationMode === 'city') { setCity(item); setDistrict(''); } else setDistrict(item); setLocationMode(null); setLocationSearch(''); }}><Text style={styles.locationRowText}>{item}</Text><ChevronRight size={16} color="#a0a8b3" /></TouchableOpacity>}
          />
        </View> : <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Sadece Acil İlanlar */}
          <View style={styles.urgentRow}>
            <View>
              <Text style={styles.urgentTitle}>🚨 Sadece Acil İlanlar</Text>
              <Text style={styles.urgentDesc}>Fiyatı piyasa altına düşmüş acil satılıklar</Text>
            </View>
            <Switch
              value={isUrgentOnly}
              onValueChange={setIsUrgentOnly}
              trackColor={{ false: BrandColors.border, true: BrandColors.danger }}
              thumbColor="#ffffff"
            />
          </View>

          {/* 2. Şehir / Konum */}
          <Text style={styles.sectionTitle}>Şehir / Konum</Text>
          <TouchableOpacity style={styles.locationSelectBox} onPress={() => { setLocationMode('city'); setLocationSearch(''); }}>
            <MapPin size={17} color={BrandColors.primary} /><Text style={[styles.locationSelectText, !city && styles.locationPlaceholder]}>{city || 'Tüm iller'}</Text><ChevronRight size={17} color="#8993a2" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.locationSelectBox, !city && styles.locationSelectDisabled]} disabled={!city} onPress={() => { setLocationMode('district'); setLocationSearch(''); }}>
            <MapPin size={17} color={city ? BrandColors.primary : '#aab2bd'} /><Text style={[styles.locationSelectText, !district && styles.locationPlaceholder]}>{district || (city ? 'Tüm ilçeler' : 'Önce il seçin')}</Text><ChevronRight size={17} color="#8993a2" />
          </TouchableOpacity>

          {/* 3. Fiyat Aralığı (TL) */}
          <Text style={styles.sectionTitle}>Fiyat Aralığı (TL)</Text>
          <View style={styles.rangeRow}>
            <TextInput
              placeholder="Min TL"
              placeholderTextColor={BrandColors.textMuted}
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
              style={[styles.input, styles.rangeInput]}
            />
            <Text style={styles.rangeSeparator}>-</Text>
            <TextInput
              placeholder="Max TL"
              placeholderTextColor={BrandColors.textMuted}
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              style={[styles.input, styles.rangeInput]}
            />
          </View>

          {showVehicleFilters ? <>
          <Text style={styles.sectionTitle}>Model Yılı</Text>
          <View style={styles.rangeRow}>
            <TextInput
              placeholder="Min Yıl (Örn: 2018)"
              placeholderTextColor={BrandColors.textMuted}
              value={minYear}
              onChangeText={setMinYear}
              keyboardType="numeric"
              style={[styles.input, styles.rangeInput]}
            />
            <Text style={styles.rangeSeparator}>-</Text>
            <TextInput
              placeholder="Max Yıl (Örn: 2024)"
              placeholderTextColor={BrandColors.textMuted}
              value={maxYear}
              onChangeText={setMaxYear}
              keyboardType="numeric"
              style={[styles.input, styles.rangeInput]}
            />
          </View>
          <Text style={styles.sectionTitle}>Kilometre (KM)</Text>
          <View style={styles.rangeRow}>
            <TextInput placeholder="Min KM" placeholderTextColor={BrandColors.textMuted} value={minKm} onChangeText={setMinKm} keyboardType="numeric" style={[styles.input, styles.rangeInput]} />
            <Text style={styles.rangeSeparator}>-</Text>
            <TextInput placeholder="Max KM" placeholderTextColor={BrandColors.textMuted} value={maxKm} onChangeText={setMaxKm} keyboardType="numeric" style={[styles.input, styles.rangeInput]} />
          </View>
          </> : null}
          {showPropertyFilters ? <>
          <Text style={styles.sectionTitle}>Metrekare (m²)</Text>
          <View style={styles.rangeRow}>
            <TextInput placeholder="Min m²" placeholderTextColor={BrandColors.textMuted} value={minM2} onChangeText={setMinM2} keyboardType="numeric" style={[styles.input, styles.rangeInput]} />
            <Text style={styles.rangeSeparator}>-</Text>
            <TextInput placeholder="Max m²" placeholderTextColor={BrandColors.textMuted} value={maxM2} onChangeText={setMaxM2} keyboardType="numeric" style={[styles.input, styles.rangeInput]} />
          </View>
          </> : null}

          {attributes.filter((attribute) => ['SELECT', 'MULTI', 'BOOLEAN'].includes(attribute.type) && attribute.options?.length).map((attribute) => (
            <View key={attribute.id}>
              <Text style={styles.sectionTitle}>{attribute.name}</Text>
              <View style={styles.chipGrid}>
                {(attribute.options || []).map((option) => {
                  const selected = selectedAttrs[attribute.name] || [];
                  const isSelected = selected.includes(option);
                  return (
                    <TouchableOpacity key={option} onPress={() => setSelectedAttrs((current) => {
                      const values = current[attribute.name] || [];
                      const next = isSelected ? values.filter((value) => value !== option) : [...values, option];
                      return { ...current, [attribute.name]: next };
                    })} style={[styles.chip, isSelected && styles.chipActive]} activeOpacity={0.7}>
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>}

        {/* Alt Buton: Sonuçları Göster */}
        {!locationMode ? <View style={styles.footer}>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply} activeOpacity={0.85}>
            <Check size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.applyButtonText}>Filtreleri Uygula</Text>
          </TouchableOpacity>
        </View> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: BrandColors.text,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetText: {
    fontSize: 13,
    fontWeight: '600',
    color: BrandColors.danger,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  locationPicker: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  locationSearch: { height: 46, borderRadius: 12, backgroundColor: BrandColors.background, borderWidth: 1, borderColor: BrandColors.border, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  locationSearchInput: { flex: 1, color: BrandColors.text, fontSize: 15, height: '100%' },
  locationRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BrandColors.border, paddingHorizontal: 4 },
  locationRowText: { color: BrandColors.text, fontSize: 15, fontWeight: '600' },
  locationSelectBox: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: BrandColors.border, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, marginBottom: 8 },
  locationSelectText: { flex: 1, color: BrandColors.text, fontSize: 14, fontWeight: '600' },
  locationPlaceholder: { color: BrandColors.textMuted, fontWeight: '500' },
  locationSelectDisabled: { opacity: 0.65, backgroundColor: BrandColors.background },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecdca',
    marginBottom: 20,
  },
  urgentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BrandColors.danger,
    marginBottom: 2,
  },
  urgentDesc: {
    fontSize: 11,
    color: BrandColors.textSecondary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BrandColors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    height: 44,
    backgroundColor: BrandColors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: BrandColors.text,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rangeInput: {
    flex: 1,
  },
  rangeSeparator: {
    fontSize: 16,
    color: BrandColors.textMuted,
    fontWeight: '700',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  chipActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: BrandColors.textSecondary,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    backgroundColor: '#ffffff',
  },
  applyButton: {
    backgroundColor: BrandColors.primary,
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
