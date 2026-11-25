import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, G, Path, Text as SvgText } from 'react-native-svg';
import { RotateCcw } from 'lucide-react-native';
import type { AttrDef } from '@/api/types';
import { formatNumber, formatPrice } from '@/lib/format';
import { Button, Input, Text, radius, space, useTheme } from '@/ui';

export type DamagePartState = 'orijinal' | 'lokal' | 'boyali' | 'degisen';

export type DamagePartId =
  | 'on_tampon'
  | 'kaput'
  | 'tavan'
  | 'bagaj'
  | 'arka_tampon'
  | 'sol_on_camurluk'
  | 'sol_on_kapi'
  | 'sol_arka_kapi'
  | 'sol_arka_camurluk'
  | 'sag_on_camurluk'
  | 'sag_on_kapi'
  | 'sag_arka_kapi'
  | 'sag_arka_camurluk';

export type VehicleDamageData = {
  parts: Record<DamagePartId, DamagePartState>;
  tramer: number | null;
};

export const DAMAGE_PARTS: readonly { id: DamagePartId; label: string; shortLabel: string }[] = [
  { id: 'on_tampon', label: 'Ön Tampon', shortLabel: 'Ön Tampon' },
  { id: 'kaput', label: 'Kaput', shortLabel: 'Kaput' },
  { id: 'tavan', label: 'Tavan', shortLabel: 'Tavan' },
  { id: 'bagaj', label: 'Bagaj', shortLabel: 'Bagaj' },
  { id: 'arka_tampon', label: 'Arka Tampon', shortLabel: 'Arka Tampon' },
  { id: 'sol_on_camurluk', label: 'Sol Ön Çamurluk', shortLabel: 'Sol Ön Çam.' },
  { id: 'sol_on_kapi', label: 'Sol Ön Kapı', shortLabel: 'Sol Ön Kapı' },
  { id: 'sol_arka_kapi', label: 'Sol Arka Kapı', shortLabel: 'Sol Arka Kapı' },
  { id: 'sol_arka_camurluk', label: 'Sol Arka Çamurluk', shortLabel: 'Sol Arka Çam.' },
  { id: 'sag_on_camurluk', label: 'Sağ Ön Çamurluk', shortLabel: 'Sağ Ön Çam.' },
  { id: 'sag_on_kapi', label: 'Sağ Ön Kapı', shortLabel: 'Sağ Ön Kapı' },
  { id: 'sag_arka_kapi', label: 'Sağ Arka Kapı', shortLabel: 'Sağ Arka Kapı' },
  { id: 'sag_arka_camurluk', label: 'Sağ Arka Çamurluk', shortLabel: 'Sağ Arka Çam.' },
];

type DamageStatePalette = {
  dot: string;
  fill: string;
  stroke: string;
  badgeBg: string;
  badgeBorder: string;
  text: string;
};

export const DAMAGE_STATES: readonly {
  key: DamagePartState;
  code: string;
  label: string;
  light: DamageStatePalette;
  dark: DamageStatePalette;
}[] = [
  {
    key: 'orijinal',
    code: '0',
    label: 'Orijinal',
    light: {
      dot: '#10b981',
      fill: 'rgba(16, 185, 129, 0.15)',
      stroke: 'rgba(5, 150, 105, 0.55)',
      badgeBg: 'rgba(16, 185, 129, 0.10)',
      badgeBorder: 'rgba(16, 185, 129, 0.30)',
      text: '#047857',
    },
    dark: {
      dot: '#10b981',
      fill: 'rgba(16, 185, 129, 0.18)',
      stroke: 'rgba(52, 211, 153, 0.60)',
      badgeBg: 'rgba(16, 185, 129, 0.14)',
      badgeBorder: 'rgba(52, 211, 153, 0.35)',
      text: '#6ee7b7',
    },
  },
  {
    key: 'lokal',
    code: '1',
    label: 'Lokal Boyalı',
    light: {
      dot: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.35)',
      stroke: '#d97706',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
      badgeBorder: 'rgba(245, 158, 11, 0.35)',
      text: '#b45309',
    },
    dark: {
      dot: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.35)',
      stroke: '#fbbf24',
      badgeBg: 'rgba(245, 158, 11, 0.18)',
      badgeBorder: 'rgba(251, 191, 36, 0.40)',
      text: '#fcd34d',
    },
  },
  {
    key: 'boyali',
    code: '2',
    label: 'Boyalı',
    light: {
      dot: '#3b82f6',
      fill: 'rgba(59, 130, 246, 0.35)',
      stroke: '#2563eb',
      badgeBg: 'rgba(59, 130, 246, 0.15)',
      badgeBorder: 'rgba(59, 130, 246, 0.35)',
      text: '#1d4ed8',
    },
    dark: {
      dot: '#3b82f6',
      fill: 'rgba(59, 130, 246, 0.35)',
      stroke: '#60a5fa',
      badgeBg: 'rgba(59, 130, 246, 0.18)',
      badgeBorder: 'rgba(96, 165, 250, 0.40)',
      text: '#93c5fd',
    },
  },
  {
    key: 'degisen',
    code: '3',
    label: 'Değişen',
    light: {
      dot: '#f43f5e',
      fill: 'rgba(244, 63, 94, 0.35)',
      stroke: '#e11d48',
      badgeBg: 'rgba(244, 63, 94, 0.15)',
      badgeBorder: 'rgba(244, 63, 94, 0.35)',
      text: '#be123c',
    },
    dark: {
      dot: '#f43f5e',
      fill: 'rgba(244, 63, 94, 0.35)',
      stroke: '#fb7185',
      badgeBg: 'rgba(244, 63, 94, 0.18)',
      badgeBorder: 'rgba(251, 113, 133, 0.40)',
      text: '#fda4af',
    },
  },
];

const STATE_BY_KEY = new Map(DAMAGE_STATES.map((s) => [s.key, s]));
const STATE_BY_CODE = new Map(DAMAGE_STATES.map((s) => [s.code, s.key]));
const NEXT_STATE: Record<DamagePartState, DamagePartState> = {
  orijinal: 'lokal',
  lokal: 'boyali',
  boyali: 'degisen',
  degisen: 'orijinal',
};

export function createEmptyDamageData(): VehicleDamageData {
  const parts = {} as Record<DamagePartId, DamagePartState>;
  for (const part of DAMAGE_PARTS) parts[part.id] = 'orijinal';
  return { parts, tramer: null };
}

/** Parses either the compact `{ p, t }` format or verbose `{ parts, tramer }` JSON. */
export function parseDamageValue(raw: unknown): VehicleDamageData {
  const empty = createEmptyDamageData();
  if (typeof raw !== 'string' || !raw.trim()) return empty;
  try {
    const parsed = JSON.parse(raw) as {
      p?: unknown;
      t?: unknown;
      parts?: Record<string, unknown>;
      tramer?: unknown;
    };
    if (!parsed || typeof parsed !== 'object') return empty;

    if (typeof parsed.p === 'string') {
      DAMAGE_PARTS.forEach((part, idx) => {
        const mapped = STATE_BY_CODE.get(parsed.p?.toString().charAt(idx) ?? '0');
        if (mapped) empty.parts[part.id] = mapped;
      });
    } else if (parsed.parts && typeof parsed.parts === 'object') {
      for (const part of DAMAGE_PARTS) {
        const val = parsed.parts[part.id];
        if (typeof val === 'string' && STATE_BY_KEY.has(val as DamagePartState)) {
          empty.parts[part.id] = val as DamagePartState;
        }
      }
    }

    const rawTramer = parsed.t !== undefined ? parsed.t : parsed.tramer;
    if (typeof rawTramer === 'number' && Number.isFinite(rawTramer) && rawTramer >= 0) {
      empty.tramer = Math.round(rawTramer);
    }
    return empty;
  } catch {
    return empty;
  }
}

/**
 * Serializes into a compact JSON string encoding all 13 panels and optional Tramer amount.
 * Returns `""` when every part is original and no Tramer value was entered.
 */
export function serializeDamageValue(data: VehicleDamageData): string {
  const hasNonOriginal = DAMAGE_PARTS.some((p) => data.parts[p.id] && data.parts[p.id] !== 'orijinal');
  const hasTramer = typeof data.tramer === 'number' && Number.isFinite(data.tramer) && data.tramer >= 0;
  if (!hasNonOriginal && !hasTramer) return '';

  const codes = DAMAGE_PARTS.map((p) => STATE_BY_KEY.get(data.parts[p.id] ?? 'orijinal')?.code ?? '0').join('');
  const payload: { p: string; t?: number } = { p: codes };
  if (hasTramer) payload.t = Math.round(data.tramer as number);
  return JSON.stringify(payload);
}

/** True when serialized damage or Tramer information is present. */
export function hasDamageData(raw: unknown): boolean {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  const parsed = parseDamageValue(raw);
  return DAMAGE_PARTS.some((p) => parsed.parts[p.id] !== 'orijinal') || parsed.tramer !== null;
}

/** Derives summary counts per state across the 13 body panels. */
export function summarizeDamage(data: VehicleDamageData): Record<DamagePartState, number> {
  const counts: Record<DamagePartState, number> = { orijinal: 0, lokal: 0, boyali: 0, degisen: 0 };
  for (const part of DAMAGE_PARTS) {
    counts[data.parts[part.id] ?? 'orijinal'] += 1;
  }
  return counts;
}

/** Keeps `_damage`, `Boya-Değişen`, and `Hasar Kaydı` attributes in sync just like Web. */
export function syncDamageAttrs(
  prev: Record<string, string | number>,
  nextDamage: VehicleDamageData,
  attrs: readonly AttrDef[],
): Record<string, string | number> {
  const serialized = serializeDamageValue(nextDamage);
  const counts = summarizeDamage(nextDamage);
  const next = { ...prev };
  if (serialized) next['_damage'] = serialized;
  else delete next['_damage'];

  const boyaAttr = attrs.find((a) => a.name === 'Boya-Değişen');
  if (boyaAttr) {
    const painted = counts.boyali + counts.lokal;
    const val =
      painted > 0 && counts.degisen > 0
        ? 'Boyalı + Değişen'
        : counts.degisen > 0
          ? 'Değişen'
          : painted > 0
            ? 'Boyalı'
            : serialized
              ? 'Tamamı Orijinal'
              : '';
    if (val && (!boyaAttr.options?.length || boyaAttr.options.includes(val))) {
      next['Boya-Değişen'] = val;
    }
  }

  const hasarAttr = attrs.find((a) => a.name === 'Hasar Kaydı');
  if (hasarAttr && nextDamage.tramer !== null) {
    const val = nextDamage.tramer > 0 ? 'Var' : 'Yok';
    if (!hasarAttr.options?.length || hasarAttr.options.includes(val)) {
      next['Hasar Kaydı'] = val;
    }
  }

  return next;
}

type SvgPartShape = {
  id: DamagePartId;
  d: string;
  labelX: number;
  labelY: number;
  rotate?: number;
};

const SVG_SHAPES: readonly SvgPartShape[] = [
  { id: 'on_tampon', d: 'M76 28 Q140 8 204 28 L198 48 Q140 36 82 48 Z', labelX: 140, labelY: 32 },
  { id: 'kaput', d: 'M82 52 Q140 42 198 52 L192 126 L88 126 Z', labelX: 140, labelY: 90 },
  { id: 'tavan', d: 'M88 156 L192 156 L192 268 L88 268 Z', labelX: 140, labelY: 214 },
  { id: 'bagaj', d: 'M88 294 L192 294 L198 352 Q140 362 82 352 Z', labelX: 140, labelY: 326 },
  { id: 'arka_tampon', d: 'M78 358 Q140 368 202 358 L206 378 Q140 394 74 378 Z', labelX: 140, labelY: 376 },
  { id: 'sol_on_camurluk', d: 'M42 54 Q60 48 76 52 L82 128 L42 128 Z', labelX: 60, labelY: 92, rotate: -90 },
  { id: 'sol_on_kapi', d: 'M42 134 L82 134 L82 210 L42 210 Z', labelX: 62, labelY: 172, rotate: -90 },
  { id: 'sol_arka_kapi', d: 'M42 216 L82 216 L82 290 L42 290 Z', labelX: 62, labelY: 253, rotate: -90 },
  { id: 'sol_arka_camurluk', d: 'M42 296 L82 296 L76 352 Q56 356 42 346 Z', labelX: 60, labelY: 324, rotate: -90 },
  { id: 'sag_on_camurluk', d: 'M204 52 Q220 48 238 54 L238 128 L198 128 Z', labelX: 220, labelY: 92, rotate: 90 },
  { id: 'sag_on_kapi', d: 'M198 134 L238 134 L238 210 L198 210 Z', labelX: 218, labelY: 172, rotate: 90 },
  { id: 'sag_arka_kapi', d: 'M198 216 L238 216 L238 290 L198 290 Z', labelX: 218, labelY: 253, rotate: 90 },
  { id: 'sag_arka_camurluk', d: 'M198 296 L238 296 L238 346 Q224 356 204 352 Z', labelX: 220, labelY: 324, rotate: 90 },
];

const PART_BY_ID = new Map(DAMAGE_PARTS.map((p) => [p.id, p]));

export function VehicleDamageSvg({
  value,
  onChange,
  readOnly = false,
}: {
  value: VehicleDamageData;
  onChange?: (next: VehicleDamageData) => void;
  readOnly?: boolean;
}) {
  const { c, dark } = useTheme();
  const [selectedPart, setSelectedPart] = useState<DamagePartId>('kaput');
  const counts = summarizeDamage(value);
  const activePart = PART_BY_ID.get(selectedPart) ?? DAMAGE_PARTS[0];
  const activeState = value.parts[selectedPart] ?? 'orijinal';
  const changedParts = DAMAGE_PARTS.filter((p) => value.parts[p.id] !== 'orijinal');

  const paletteOf = (key: DamagePartState): DamageStatePalette => {
    const spec = STATE_BY_KEY.get(key) ?? DAMAGE_STATES[0];
    return dark ? spec.dark : spec.light;
  };

  function updatePart(id: DamagePartId, state: DamagePartState) {
    if (readOnly || !onChange) return;
    onChange({
      ...value,
      parts: { ...value.parts, [id]: state },
    });
  }

  function cyclePart(id: DamagePartId) {
    if (readOnly || !onChange) return;
    setSelectedPart(id);
    const cur = value.parts[id] ?? 'orijinal';
    updatePart(id, NEXT_STATE[cur]);
  }

  function resetAll() {
    if (readOnly || !onChange) return;
    onChange(createEmptyDamageData());
  }

  return (
    <View style={styles.container}>
      {/* Legend + reset */}
      <View style={styles.legendRow}>
        <View style={styles.legendWrap}>
          {DAMAGE_STATES.map((s) => {
            const pal = dark ? s.dark : s.light;
            return (
              <View
                key={s.key}
                style={[styles.legendPill, { backgroundColor: pal.badgeBg, borderColor: pal.badgeBorder }]}
              >
                <View style={[styles.dot, { backgroundColor: pal.dot }]} />
                <Text style={[styles.legendText, { color: pal.text }]}>
                  {s.label} ({counts[s.key]})
                </Text>
              </View>
            );
          })}
        </View>
        {!readOnly && (changedParts.length > 0 || value.tramer !== null) ? (
          <Button size="sm" variant="ghost" icon={RotateCcw} title="Sıfırla" onPress={resetAll} />
        ) : null}
      </View>

      {/* Top-down 13-part SVG vehicle diagram */}
      <View style={[styles.diagramCard, { borderColor: c.border, backgroundColor: c.elevated }]}>
        <View style={styles.axisRow}>
          <Text variant="small" tone="subtle" style={styles.axisLabel}>SOL</Text>
          <Text variant="small" tone="subtle" style={styles.axisLabel}>ÖN</Text>
          <Text variant="small" tone="subtle" style={styles.axisLabel}>SAĞ</Text>
        </View>
        <Svg
          viewBox="0 0 280 404"
          width={230}
          height={Math.round(230 * (404 / 280))}
          accessibilityLabel="Araç boya ve değişen şeması"
        >
          {/* Windshield & rear glass */}
          <Path d="M90 130 L190 130 L184 152 L96 152 Z" fill={c.border} fillOpacity={0.35} stroke={c.border} strokeWidth={1.2} />
          <Path d="M96 272 L184 272 L190 290 L90 290 Z" fill={c.border} fillOpacity={0.35} stroke={c.border} strokeWidth={1.2} />
          {/* Side mirrors */}
          <Ellipse cx={34} cy={136} rx={7} ry={4} fill={c.border} fillOpacity={0.5} stroke={c.border} strokeWidth={1} />
          <Ellipse cx={246} cy={136} rx={7} ry={4} fill={c.border} fillOpacity={0.5} stroke={c.border} strokeWidth={1} />

          {SVG_SHAPES.map((shape) => {
            const stateKey = value.parts[shape.id] ?? 'orijinal';
            const pal = paletteOf(stateKey);
            const isSelected = !readOnly && selectedPart === shape.id;
            const shortTag =
              stateKey === 'orijinal'
                ? ''
                : stateKey === 'lokal'
                  ? 'Lokal'
                  : stateKey === 'boyali'
                    ? 'Boyalı'
                    : 'Değişen';

            return (
              <G
                key={shape.id}
                onPress={readOnly ? undefined : () => cyclePart(shape.id)}
              >
                <Path
                  d={shape.d}
                  fill={pal.fill}
                  stroke={pal.stroke}
                  strokeWidth={isSelected ? 2.4 : 1.5}
                  strokeLinejoin="round"
                />
                {shortTag ? (
                  <SvgText
                    x={shape.labelX}
                    y={shape.labelY}
                    textAnchor="middle"
                    alignmentBaseline="central"
                    originX={shape.labelX}
                    originY={shape.labelY}
                    rotation={shape.rotate ?? 0}
                    fill={c.fg}
                    fontSize={9}
                    fontWeight="700"
                  >
                    {shortTag}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
        <Text variant="small" tone="subtle" style={styles.axisLabel}>ARKA</Text>
        {!readOnly ? (
          <Text variant="caption" tone="muted" center style={{ marginTop: space.xs }}>
            Parçaya dokunarak durumu değiştirin
          </Text>
        ) : null}
      </View>

      {/* Selected part controls when editing */}
      {!readOnly ? (
        <View style={[styles.selectedCard, { borderColor: c.border, backgroundColor: c.elevated }]}>
          <Text variant="label">
            Seçili parça: <Text variant="label" tone="primary">{activePart.label}</Text>
          </Text>
          <View style={styles.radioRow}>
            {DAMAGE_STATES.map((s) => {
              const pal = dark ? s.dark : s.light;
              const selected = activeState === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => updatePart(activePart.id, s.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.radioChip,
                    selected
                      ? { backgroundColor: pal.badgeBg, borderColor: c.primary }
                      : { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <Text variant="label" style={{ color: selected ? pal.text : c.muted }}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* 13-part list */}
      <View style={styles.partsGrid}>
        {DAMAGE_PARTS.map((part) => {
          const stateKey = value.parts[part.id] ?? 'orijinal';
          const st = STATE_BY_KEY.get(stateKey) ?? DAMAGE_STATES[0];
          const pal = paletteOf(stateKey);
          const isSelected = !readOnly && selectedPart === part.id;

          if (readOnly) {
            return (
              <View key={part.id} style={[styles.partRow, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Text variant="caption" tone="muted" numberOfLines={1} style={styles.partLabel}>
                  {part.label}
                </Text>
                <View style={[styles.stateBadge, { backgroundColor: pal.badgeBg, borderColor: pal.badgeBorder }]}>
                  <Text style={[styles.stateBadgeText, { color: pal.text }]}>{st.label}</Text>
                </View>
              </View>
            );
          }

          return (
            <Pressable
              key={part.id}
              onPress={() => cyclePart(part.id)}
              style={[
                styles.partRow,
                {
                  borderColor: isSelected ? c.primary : c.border,
                  backgroundColor: isSelected ? c.primarySoft : c.surface,
                },
              ]}
            >
              <Text variant="label" numberOfLines={1} style={styles.partLabel}>
                {part.label}
              </Text>
              <View style={[styles.stateBadge, { backgroundColor: pal.badgeBg, borderColor: pal.badgeBorder }]}>
                <Text style={[styles.stateBadgeText, { color: pal.text }]}>{st.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Tramer field */}
      {readOnly ? (
        <View style={[styles.tramerReadRow, { borderColor: c.border, backgroundColor: c.elevated }]}>
          <Text variant="label" tone="muted">Tramer / Hasar Kaydı Tutarı</Text>
          <Text variant="bodyStrong">
            {value.tramer === null ? 'Belirtilmedi' : value.tramer === 0 ? '0 ₺ (Yok)' : formatPrice(value.tramer, 'TRY')}
          </Text>
        </View>
      ) : (
        <Input
          label="Tramer Tutarı (TL, isteğe bağlı)"
          keyboardType="numeric"
          value={value.tramer !== null ? formatNumber(value.tramer) : ''}
          onChangeText={(txt) => {
            if (!onChange) return;
            const digits = txt.replace(/\D/g, '').slice(0, 9);
            onChange({
              ...value,
              tramer: digits === '' ? null : Number(digits),
            });
          }}
          placeholder="Örn. 15.000 veya 0"
          suffix="TL"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
  diagramCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 230,
    marginBottom: 4,
  },
  axisLabel: { letterSpacing: 1, fontSize: 10, fontWeight: '700' },
  selectedCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
  },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  radioChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  partsGrid: { gap: 6 },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  partLabel: { flex: 1 },
  stateBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stateBadgeText: { fontSize: 11, fontWeight: '600' },
  tramerReadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
