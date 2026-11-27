import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AttrDef } from '@/api/types';
import { OptionPicker } from '@/features/location/OptionPicker';
import { maskThousands, parseMasked } from '@/lib/format';
import { Chip, Input, SelectField, Segmented, Text, space } from '@/ui';

const YES_NO = ['Evet', 'Hayır'];

const INTEGER_ATTR_RE = /^(yıl|model yılı|km|kilometre|m²|metrekare|bina yaşı|kat sayısı|bulunduğu kat|banyo sayısı|oda sayısı)$/i;

function sanitizeDecimalInput(raw: string): string {
  const normalized = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const firstDot = normalized.indexOf('.');
  if (firstDot === -1) return normalized.slice(0, 10);
  const intPart = normalized.slice(0, firstDot).slice(0, 8);
  const fracPart = normalized.slice(firstDot + 1).replace(/\./g, '').slice(0, 4);
  return `${intPart}.${fracPart}`;
}

/** One attribute input, storing values the way the website does (keyed by attribute name). */
export function AttrField({
  attr,
  value,
  onChange,
  error,
  hint,
}: {
  attr: AttrDef;
  value: string | number | undefined;
  onChange: (value: string | number | undefined) => void;
  error?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = attr.unit ? `${attr.name} (${attr.unit})` : attr.name;

  if (attr.type === 'SELECT') {
    return (
      <>
        <SelectField
          label={label}
          required={attr.required}
          placeholder="Seçin"
          value={value ? String(value) : null}
          error={error}
          onPress={() => setOpen(true)}
        />
        {!error && hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
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
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
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
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
      </View>
    );
  }

  if (attr.type === 'NUMBER') {
    const isYear = attr.name === 'Yıl' || attr.name === 'Model Yılı';
    const isInteger = isYear || INTEGER_ATTR_RE.test(attr.name.trim());
    if (!isInteger) {
      return (
        <Input
          label={label}
          required={attr.required}
          keyboardType="decimal-pad"
          placeholder="0"
          error={error}
          hint={hint}
          value={value === undefined || value === '' ? '' : String(value)}
          onChangeText={(t) => {
            const cleaned = sanitizeDecimalInput(t);
            onChange(cleaned === '' ? undefined : cleaned);
          }}
        />
      );
    }
    return (
      <Input
        label={label}
        required={attr.required}
        keyboardType="number-pad"
        placeholder={isYear ? `Örn. ${new Date().getFullYear() - 3}` : '0'}
        error={error}
        hint={hint}
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
      error={error}
      hint={hint}
      value={value === undefined ? '' : String(value)}
      onChangeText={(t) => onChange(t ? t.slice(0, 200) : undefined)}
      maxLength={200}
    />
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
