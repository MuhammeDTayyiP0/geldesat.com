import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, ScrollView, TouchableOpacity, TextInput, Switch, SafeAreaView } from 'react-native';
import { X, RotateCcw, Check } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';

export interface FilterState {
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  fuel?: string;
  gear?: string;
  isUrgentOnly?: boolean;
  city?: string;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

const FUEL_TYPES = ['Benzin', 'Dizel', 'Hibrit', 'Elektrik', 'LPG'];
const GEAR_TYPES = ['Otomatik', 'Manuel', 'Yarı Otomatik'];

export function FilterModal({ visible, onClose, onApply, initialFilters = {} }: FilterModalProps) {
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice || '');
  const [minYear, setMinYear] = useState(initialFilters.minYear || '');
  const [maxYear, setMaxYear] = useState(initialFilters.maxYear || '');
  const [selectedFuel, setSelectedFuel] = useState<string | undefined>(initialFilters.fuel);
  const [selectedGear, setSelectedGear] = useState<string | undefined>(initialFilters.gear);
  const [isUrgentOnly, setIsUrgentOnly] = useState(initialFilters.isUrgentOnly || false);
  const [city, setCity] = useState(initialFilters.city || '');

  const handleReset = () => {
    setMinPrice('');
    setMaxPrice('');
    setMinYear('');
    setMaxYear('');
    setSelectedFuel(undefined);
    setSelectedGear(undefined);
    setIsUrgentOnly(false);
    setCity('');
  };

  const handleApply = () => {
    onApply({
      minPrice: minPrice.trim() || undefined,
      maxPrice: maxPrice.trim() || undefined,
      minYear: minYear.trim() || undefined,
      maxYear: maxYear.trim() || undefined,
      fuel: selectedFuel,
      gear: selectedGear,
      isUrgentOnly,
      city: city.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Başlık Barı */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <X size={22} color={BrandColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filtreler</Text>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <RotateCcw size={15} color={BrandColors.danger} style={{ marginRight: 4 }} />
            <Text style={styles.resetText}>Temizle</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
          <TextInput
            placeholder="Örn: İstanbul, Ankara, İzmir..."
            placeholderTextColor={BrandColors.textMuted}
            value={city}
            onChangeText={setCity}
            style={styles.input}
          />

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

          {/* 4. Model Yılı */}
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

          {/* 5. Yakıt Tipi */}
          <Text style={styles.sectionTitle}>Yakıt Tipi</Text>
          <View style={styles.chipGrid}>
            {FUEL_TYPES.map((fuel) => {
              const isSelected = selectedFuel === fuel;
              return (
                <TouchableOpacity
                  key={fuel}
                  onPress={() => setSelectedFuel(isSelected ? undefined : fuel)}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{fuel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 6. Vites Tipi */}
          <Text style={styles.sectionTitle}>Vites Tipi</Text>
          <View style={styles.chipGrid}>
            {GEAR_TYPES.map((gear) => {
              const isSelected = selectedGear === gear;
              return (
                <TouchableOpacity
                  key={gear}
                  onPress={() => setSelectedGear(isSelected ? undefined : gear)}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{gear}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Alt Buton: Sonuçları Göster */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply} activeOpacity={0.85}>
            <Check size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.applyButtonText}>Filtreleri Uygula</Text>
          </TouchableOpacity>
        </View>
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
