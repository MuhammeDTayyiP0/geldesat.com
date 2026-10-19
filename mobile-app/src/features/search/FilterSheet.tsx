import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Flame, LayoutGrid, MapPin, Sparkles } from 'lucide-react-native';
import { catalog } from '@/api/endpoints';
import { keys } from '@/api/queries';
import type { AttrDef } from '@/api/types';
import { TURKEY_CITIES } from '@/data/locations';
import { CategoryPicker } from '@/features/catalog/CategoryPicker';
import { OptionPicker } from '@/features/location/OptionPicker';
import { maskThousands } from '@/lib/format';
import { Button, Chip, Input, ListRow, RowGroup, SelectField, Sheet, Text, space } from '@/ui';
import { hasAreaFilter, hasVehicleFilters, optionAttributes, type FilterState } from './filters';

type Props = {
  visible: boolean;
  onClose: () => void;
  value: FilterState;
  onApply: (next: FilterState) => void;
};

export function FilterSheet({ visible, onClose, value, onApply }: Props) {
  const [draft, setDraft] = useState<FilterState>(value);
  const [picker, setPicker] = useState<'category' | 'city' | 'district' | null>(null);
  // Start from the applied filters each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(value);
  }

  const info = useQuery({
    queryKey: keys.category(draft.category ?? ''),
    queryFn: () => catalog.category(draft.category ?? ''),
    enabled: visible && !!draft.category,
    staleTime: 10 * 60_000,
  });
  const attributes = useMemo(() => info.data?.attributes ?? [], [info.data]);
  const districts = TURKEY_CITIES.find((c) => c.name === draft.city)?.districts ?? [];

  const set = (patch: Partial<FilterState>) => setDraft((d) => ({ ...d, ...patch }));
  const toggleAttr = (name: string, option: string) =>
    setDraft((d) => {
      const cur = d.attrs[name] ?? [];
      return { ...d, attrs: { ...d.attrs, [name]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option] } };
    });

  const range = (label: string, min: keyof FilterState, max: keyof FilterState, suffix?: string, plain?: boolean) => (
    <View style={styles.block}>
      <Text variant="label">{label}</Text>
      <View style={styles.range}>
        <View style={styles.flex}>
          <Input
            placeholder="En az"
            keyboardType="number-pad"
            value={String(draft[min] ?? '')}
            onChangeText={(t) => set({ [min]: plain ? t.replace(/\D/g, '').slice(0, 4) : maskThousands(t) })}
            suffix={suffix}
          />
        </View>
        <View style={styles.flex}>
          <Input
            placeholder="En çok"
            keyboardType="number-pad"
            value={String(draft[max] ?? '')}
            onChangeText={(t) => set({ [max]: plain ? t.replace(/\D/g, '').slice(0, 4) : maskThousands(t) })}
            suffix={suffix}
          />
        </View>
      </View>
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtrele"
      tall
      footer={
        <>
          <Button
            title="Temizle"
            variant="outline"
            onPress={() => setDraft({ q: draft.q, sort: draft.sort, attrs: {} })}
            style={styles.flex}
          />
          <Button
            title="Sonuçları göster"
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={styles.grow}
          />
        </>
      }
    >
      <SelectField
        label="Kategori"
        icon={LayoutGrid}
        placeholder="Tüm kategoriler"
        value={draft.categoryName ?? info.data?.category?.name ?? (draft.category ? '…' : null)}
        onPress={() => setPicker('category')}
      />
      <View style={styles.range}>
        <View style={styles.flex}>
          <SelectField label="İl" icon={MapPin} placeholder="Tüm iller" value={draft.city} onPress={() => setPicker('city')} />
        </View>
        <View style={styles.flex}>
          <SelectField
            label="İlçe"
            placeholder={draft.city ? 'Tüm ilçeler' : 'Önce il'}
            value={draft.district}
            disabled={!draft.city}
            onPress={() => setPicker('district')}
          />
        </View>
      </View>

      {range('Fiyat', 'minPrice', 'maxPrice', '₺')}
      {hasVehicleFilters(attributes) ? (
        <>
          {range('Yıl', 'minYear', 'maxYear', undefined, true)}
          {range('Kilometre', 'minKm', 'maxKm', 'km')}
        </>
      ) : null}
      {hasAreaFilter(attributes) ? range('Metrekare', 'minM2', 'maxM2', 'm²') : null}

      {optionAttributes(attributes).map((a) => (
        <AttrFilter key={a.id} attr={a} selected={draft.attrs[a.name] ?? []} onToggle={(o) => toggleAttr(a.name, o)} />
      ))}

      <RowGroup title="Öne çıkanlar">
        <ListRow icon={Flame} label="Yalnızca acil ilanlar" switchValue={!!draft.urgent} onSwitch={(v) => set({ urgent: v })} />
        <ListRow icon={Sparkles} label="Yalnızca vitrin ilanları" switchValue={!!draft.featured} onSwitch={(v) => set({ featured: v })} />
      </RowGroup>

      <CategoryPicker
        visible={picker === 'category'}
        onClose={() => setPicker(null)}
        mode="filter"
        onPick={(cat) => setDraft((d) => ({ ...d, category: cat?.slug, categoryName: cat?.name, attrs: {}, minYear: undefined, maxYear: undefined, minKm: undefined, maxKm: undefined, minM2: undefined, maxM2: undefined }))}
      />
      <OptionPicker
        visible={picker === 'city'}
        onClose={() => setPicker(null)}
        title="İl seçin"
        value={draft.city}
        allLabel="Tüm iller"
        onSelect={(city) => set({ city: city ?? undefined, district: undefined })}
      />
      <OptionPicker
        visible={picker === 'district'}
        onClose={() => setPicker(null)}
        title={`${draft.city ?? ''} ilçeleri`}
        options={districts}
        value={draft.district}
        allLabel="Tüm ilçeler"
        onSelect={(district) => set({ district: district ?? undefined })}
      />
    </Sheet>
  );
}

function AttrFilter({ attr, selected, onToggle }: { attr: AttrDef; selected: string[]; onToggle: (option: string) => void }) {
  const options = attr.type === 'BOOLEAN' ? [(attr.options ?? ['Evet'])[0] ?? 'Evet'] : (attr.options ?? []);
  if (!options.length) return null;
  if (attr.type === 'BOOLEAN') {
    return (
      <View style={styles.chips}>
        <Chip label={attr.name} selected={selected.includes(options[0])} onPress={() => onToggle(options[0])} />
      </View>
    );
  }
  return (
    <View style={styles.block}>
      <Text variant="label">
        {attr.name}
        {selected.length ? <Text variant="label" tone="primary">{`  ·  ${selected.length} seçili`}</Text> : null}
      </Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip key={o} label={o} selected={selected.includes(o)} onPress={() => onToggle(o)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 2 },
  block: { gap: space.sm },
  range: { flexDirection: 'row', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
