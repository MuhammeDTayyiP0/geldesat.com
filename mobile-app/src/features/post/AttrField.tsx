import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AttrDef } from '@/api/types';
import { OptionPicker } from '@/features/location/OptionPicker';
import { maskThousands, parseMasked } from '@/lib/format';
import { Chip, Input, SelectField, Segmented, Text, space } from '@/ui';

const YES_NO = ['Evet', 'Hayır'];

/** One attribute input, storing values the way the website does (keyed by attribute name). */
export function AttrField({
  attr,
  value,
  onChange,
}: {
  attr: AttrDef;
  value: string | number | undefined;
  onChange: (value: string | number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = attr.unit ? `${attr.name} (${attr.unit})` : attr.name;

  if (attr.type === 'SELECT') {
    return (
      <>
        <SelectField label={label} required={attr.required} placeholder="Seçin" value={value ? String(value) : null} onPress={() => setOpen(true)} />
        <OptionPicker
          visible={open}
          onClose={() => setOpen(false)}
          title={attr.name}
          options={attr.options ?? []}
          value={value ? String(value) : null}
          allLabel={attr.required ? undefined : 'Belirtilmemiş'}
          onSelect={(v) => onChange(v ?? undefined)}
        />
      </>
    );
  }

  if (attr.type === 'BOOLEAN') {
    const options = attr.options?.length ? attr.options : YES_NO;
    const current = value ? String(value) : '';
    return (
      <View style={styles.block}>
        <Text variant="label">
          {attr.name}
          {attr.required ? <Text variant="label" tone="danger"> *</Text> : null}
        </Text>
        <Segmented
          value={current}
          onChange={(v) => onChange(v === current ? undefined : v)}
          options={options.map((o) => ({ value: o, label: o }))}
        />
      </View>
    );
  }

  if (attr.type === 'MULTI') {
    const selected = String(value ?? '')
      .split(', ')
      .filter(Boolean);
    return (
      <View style={styles.block}>
        <Text variant="label">
          {attr.name}
          {attr.required ? <Text variant="label" tone="danger"> *</Text> : null}
          <Text variant="caption" tone="subtle">
            {'  '}Birden fazla seçebilirsiniz
          </Text>
        </Text>
        <View style={styles.chips}>
          {(attr.options ?? []).map((o) => {
            const on = selected.includes(o);
            return (
              <Chip
                key={o}
                label={o}
                selected={on}
                onPress={() => {
                  const next = on ? selected.filter((x) => x !== o) : [...selected, o];
                  onChange(next.length ? next.join(', ') : undefined);
                }}
              />
            );
          })}
        </View>
      </View>
    );
  }

  if (attr.type === 'NUMBER') {
    const isYear = attr.name === 'Yıl';
    return (
      <Input
        label={label}
        required={attr.required}
        keyboardType="number-pad"
        placeholder={isYear ? `Örn. ${new Date().getFullYear() - 3}` : '0'}
        value={value === undefined || value === '' ? '' : isYear ? String(value) : maskThousands(String(value))}
        onChangeText={(t) => {
          if (isYear) {
            const digits = t.replace(/\D/g, '').slice(0, 4);
            onChange(digits ? Number(digits) : undefined);
          } else onChange(parseMasked(t));
        }}
      />
    );
  }

  return (
    <Input
      label={label}
      required={attr.required}
      value={value === undefined ? '' : String(value)}
      onChangeText={(t) => onChange(t ? t.slice(0, 120) : undefined)}
      maxLength={120}
    />
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
