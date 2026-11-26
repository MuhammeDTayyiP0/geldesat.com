import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { CheckCircle2, Paintbrush, RotateCcw, ShieldCheck } from 'lucide-react-native';
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
    } else if (!serialized) {
      delete next['Boya-Değişen'];
    }
  }

  const hasarAttr = attrs.find((a) => a.name === 'Hasar Kaydı');
  if (hasarAttr) {
    if (nextDamage.tramer !== null) {
      const val = nextDamage.tramer > 0 ? 'Var' : 'Yok';
      if (!hasarAttr.options?.length || hasarAttr.options.includes(val)) {
        next['Hasar Kaydı'] = val;
      }
    } else if (!serialized) {
      delete next['Hasar Kaydı'];
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
  { id: 'on_tampon', d: 'M74 34 Q150 8 226 34 L217 56 Q150 42 83 56 Z', labelX: 150, labelY: 36 },
  { id: 'kaput', d: 'M84 61 Q150 48 216 61 L207 137 Q150 132 93 137 Z', labelX: 150, labelY: 98 },
  { id: 'tavan', d: 'M96 174 Q150 169 204 174 L204 289 Q150 294 96 289 Z', labelX: 150, labelY: 232 },
  { id: 'bagaj', d: 'M93 322 Q150 327 207 322 L216 382 Q150 394 84 382 Z', labelX: 150, labelY: 356 },
  { id: 'arka_tampon', d: 'M78 388 Q150 400 222 388 L226 410 Q150 430 74 410 Z', labelX: 150, labelY: 408 },
  { id: 'sol_on_camurluk', d: 'M46 62 Q62 52 79 59 L86 138 L44 138 Q41 98 46 62 Z', labelX: 64, labelY: 100, rotate: -90 },
  { id: 'sol_on_kapi', d: 'M44 144 L87 144 L87 224 L44 224 Z', labelX: 65, labelY: 184, rotate: -90 },
  { id: 'sol_arka_kapi', d: 'M44 230 L87 230 L87 314 L44 314 Z', labelX: 65, labelY: 272, rotate: -90 },
  { id: 'sol_arka_camurluk', d: 'M44 320 L87 320 L79 382 Q60 388 46 375 Q41 348 44 320 Z', labelX: 64, labelY: 352, rotate: -90 },
  { id: 'sag_on_camurluk', d: 'M221 59 Q238 52 254 62 Q259 98 256 138 L214 138 Z', labelX: 236, labelY: 100, rotate: 90 },
  { id: 'sag_on_kapi', d: 'M213 144 L256 144 L256 224 L213 224 Z', labelX: 235, labelY: 184, rotate: 90 },
  { id: 'sag_arka_kapi', d: 'M213 230 L256 230 L256 314 L213 314 Z', labelX: 235, labelY: 272, rotate: 90 },
  { id: 'sag_arka_camurluk', d: 'M213 320 L256 320 Q259 348 254 375 Q240 388 221 382 Z', labelX: 236, labelY: 352, rotate: 90 },
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
  const [activeBrush, setActiveBrush] = useState<DamagePartState | null>(null);
  const counts = summarizeDamage(value);
  const activePart = PART_BY_ID.get(selectedPart) ?? DAMAGE_PARTS[0];
  const activeState = value.parts[selectedPart] ?? 'orijinal';
  const changedParts = DAMAGE_PARTS.filter((p) => value.parts[p.id] !== 'orijinal');
  const isCleanCar = changedParts.length === 0;
  const activeBrushSpec = activeBrush ? STATE_BY_KEY.get(activeBrush) : undefined;
  const orijinalPal = dark ? DAMAGE_STATES[0].dark : DAMAGE_STATES[0].light;

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

  function handlePartPress(id: DamagePartId) {
    if (readOnly || !onChange) return;
    setSelectedPart(id);
    const cur = value.parts[id] ?? 'orijinal';
    if (activeBrush) {
      const next = cur === activeBrush && activeBrush !== 'orijinal' ? 'orijinal' : activeBrush;
      updatePart(id, next);
      return;
    }
    updatePart(id, NEXT_STATE[cur]);
  }

  function applyCleanPreset() {
    if (readOnly || !onChange) return;
    const base = createEmptyDamageData();
    onChange({ ...base, tramer: 0 });
  }

  function resetAll() {
    if (readOnly || !onChange) return;
    onChange(createEmptyDamageData());
  }

  return (
    <View style={styles.container}>
      {/* Read-only summary banner */}
      {readOnly ? (
        <View
          style={[
            styles.summaryBanner,
            isCleanCar
              ? { borderColor: orijinalPal.badgeBorder, backgroundColor: orijinalPal.badgeBg }
              : { borderColor: c.border, backgroundColor: c.elevated },
          ]}
        >
          <View style={styles.summaryBannerLeft}>
            {isCleanCar ? <ShieldCheck size={16} color={orijinalPal.text} /> : null}
            <Text variant="label" style={{ color: isCleanCar ? orijinalPal.text : c.fg }}>
              {isCleanCar
                ? 'Tamamı Orijinal (Boyasız / Değişensiz)'
                : [
                    counts.degisen ? `${counts.degisen} Değişen` : null,
                    counts.boyali ? `${counts.boyali} Boyalı` : null,
                    counts.lokal ? `${counts.lokal} Lokal Boyalı` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </Text>
          </View>
          {value.tramer !== null ? (
            <Text variant="caption" tone="muted">
              Tramer: <Text variant="label">{value.tramer === 0 ? 'Yok (0 ₺)' : formatPrice(value.tramer, 'TRY')}</Text>
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Legend / Interactive brush + presets */}
      <View style={styles.legendSection}>
        <View style={styles.legendRow}>
          <View style={styles.legendWrap}>
            {DAMAGE_STATES.map((s) => {
              const pal = dark ? s.dark : s.light;
              const isBrush = !readOnly && activeBrush === s.key;
              if (readOnly) {
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
              }
              return (
                <Pressable
                  key={s.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isBrush }}
                  onPress={() => setActiveBrush((prev) => (prev === s.key ? null : s.key))}
                  style={[
                    styles.legendPill,
                    {
                      backgroundColor: pal.badgeBg,
                      borderColor: isBrush ? c.primary : pal.badgeBorder,
                      borderWidth: isBrush ? 2 : 1,
                    },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: pal.dot }]} />
                  <Text style={[styles.legendText, { color: pal.text }]}>
                    {s.label} ({counts[s.key]})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!readOnly ? (
          <>
            <View style={styles.presetRow}>
              <Pressable
                accessibilityRole="button"
                onPress={applyCleanPreset}
                style={[
                  styles.presetBtn,
                  isCleanCar && value.tramer === 0
                    ? { borderColor: orijinalPal.badgeBorder, backgroundColor: orijinalPal.badgeBg }
                    : { borderColor: c.border, backgroundColor: c.surface },
                ]}
              >
                <CheckCircle2 size={14} color={isCleanCar && value.tramer === 0 ? orijinalPal.text : c.muted} />
                <Text variant="small" style={{ fontWeight: '600', color: isCleanCar && value.tramer === 0 ? orijinalPal.text : c.fg }}>
                  Tamamı Orijinal · Tramer Yok
                </Text>
              </Pressable>
              {changedParts.length > 0 || value.tramer !== null ? (
                <Button size="sm" variant="ghost" icon={RotateCcw} title="Sıfırla" onPress={resetAll} />
              ) : null}
            </View>
            <View style={styles.brushHintRow}>
              <Paintbrush size={13} color={c.primary} />
              <Text variant="caption" tone="muted" style={styles.flexOne}>
                {activeBrushSpec
                  ? `Hızlı işaretleme fırçası: ${activeBrushSpec.label} — dokunduğunuz parça bu duruma geçer.`
                  : 'Hızlı işaretleme fırçası için yukarıdaki bir duruma dokunun ya da doğrudan parçaya dokunup değiştirin.'}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Top-down 13-part SVG vehicle diagram */}
      <View style={[styles.diagramCard, { borderColor: c.border, backgroundColor: c.elevated }]}>
        <View style={styles.axisRow}>
          <View style={[styles.axisPill, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Text variant="small" tone="subtle" style={styles.axisLabel}>SOL</Text>
          </View>
          <View style={[styles.axisPill, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Text variant="small" style={[styles.axisLabel, { color: c.fg }]}>ÖN</Text>
          </View>
          <View style={[styles.axisPill, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Text variant="small" tone="subtle" style={styles.axisLabel}>SAĞ</Text>
          </View>
        </View>
        <Svg
          viewBox="0 0 300 440"
          width={244}
          height={Math.round(244 * (440 / 300))}
          accessibilityLabel="Araç boya ve değişen şeması"
        >
          <Defs>
            <RadialGradient id="mobCarShadow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#0f172a" stopOpacity={dark ? 0.45 : 0.22} />
              <Stop offset="70%" stopColor="#0f172a" stopOpacity={dark ? 0.18 : 0.08} />
              <Stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="mobGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#334155" stopOpacity={0.5} />
              <Stop offset="50%" stopColor="#1e293b" stopOpacity={0.65} />
              <Stop offset="100%" stopColor="#475569" stopOpacity={0.45} />
            </LinearGradient>
          </Defs>

          {/* Soft ground drop shadow */}
          <Ellipse cx={150} cy={226} rx={126} ry={204} fill="url(#mobCarShadow)" />

          {/* Wheels / tires */}
          <Rect x={30} y={76} width={12} height={52} rx={5.5} fill={dark ? '#334155' : '#1e293b'} fillOpacity={0.82} stroke={c.border} strokeWidth={1} />
          <Rect x={258} y={76} width={12} height={52} rx={5.5} fill={dark ? '#334155' : '#1e293b'} fillOpacity={0.82} stroke={c.border} strokeWidth={1} />
          <Rect x={30} y={314} width={12} height={52} rx={5.5} fill={dark ? '#334155' : '#1e293b'} fillOpacity={0.82} stroke={c.border} strokeWidth={1} />
          <Rect x={258} y={314} width={12} height={52} rx={5.5} fill={dark ? '#334155' : '#1e293b'} fillOpacity={0.82} stroke={c.border} strokeWidth={1} />

          {/* Outer aerodynamic chassis silhouette */}
          <Path
            d="M72 30 Q150 4 228 30 Q262 52 262 110 L262 346 Q262 396 228 412 Q150 434 72 412 Q38 396 38 346 L38 110 Q38 52 72 30 Z"
            fill={c.surface}
            fillOpacity={0.6}
            stroke={c.border}
            strokeWidth={1.2}
          />

          {/* Headlights & LED DRLs */}
          <Path d="M55 44 Q70 30 82 35 L75 49 Q63 47 53 52 Z" fill="rgba(252, 211, 77, 0.45)" stroke="rgba(245, 158, 11, 0.72)" strokeWidth={1.1} />
          <Path d="M245 44 Q230 30 218 35 L225 49 Q237 47 247 52 Z" fill="rgba(252, 211, 77, 0.45)" stroke="rgba(245, 158, 11, 0.72)" strokeWidth={1.1} />
          {/* Taillights */}
          <Path d="M54 388 Q66 396 80 393 L82 405 Q65 408 52 398 Z" fill="rgba(244, 63, 94, 0.45)" stroke="rgba(244, 63, 94, 0.75)" strokeWidth={1.1} />
          <Path d="M246 388 Q234 396 220 393 L218 405 Q235 408 248 398 Z" fill="rgba(244, 63, 94, 0.45)" stroke="rgba(244, 63, 94, 0.75)" strokeWidth={1.1} />

          {/* Side mirrors */}
          <Path d="M23 148 Q30 140 43 146 L43 156 Q31 159 23 152 Z" fill={c.surface} stroke={c.border} strokeWidth={1.2} />
          <Path d="M277 148 Q270 140 257 146 L257 156 Q269 159 277 152 Z" fill={c.surface} stroke={c.border} strokeWidth={1.2} />

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
                onPress={readOnly ? undefined : () => handlePartPress(shape.id)}
              >
                <Path
                  d={shape.d}
                  fill={pal.fill}
                  stroke={isSelected ? c.primary : pal.stroke}
                  strokeWidth={isSelected ? 2.8 : 1.5}
                  strokeLinejoin="round"
                />
                {shortTag ? (
                  <G
                    originX={shape.labelX}
                    originY={shape.labelY}
                    rotation={shape.rotate ?? 0}
                  >
                    <Rect
                      x={shape.labelX - 24}
                      y={shape.labelY - 9}
                      width={48}
                      height={18}
                      rx={6}
                      fill={c.surface}
                      fillOpacity={0.92}
                      stroke={c.border}
                      strokeOpacity={0.7}
                      strokeWidth={0.7}
                    />
                    <SvgText
                      x={shape.labelX}
                      y={shape.labelY}
                      textAnchor="middle"
                      alignmentBaseline="central"
                      fill={c.fg}
                      fontSize={9}
                      fontWeight="700"
                    >
                      {shortTag}
                    </SvgText>
                  </G>
                ) : null}
              </G>
            );
          })}

          {/* Decorative hood crease lines, panoramic roof & glass cabin */}
          <Path d="M108 72 L114 128" stroke={c.border} strokeOpacity={0.45} strokeWidth={1} strokeLinecap="round" />
          <Path d="M192 72 L186 128" stroke={c.border} strokeOpacity={0.45} strokeWidth={1} strokeLinecap="round" />
          <Rect x={108} y={186} width={84} height={86} rx={14} fill="none" stroke={c.border} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="3 3" />
          <Path d="M94 140 Q150 132 206 140 L199 169 Q150 163 101 169 Z" fill="url(#mobGlassGrad)" stroke={c.border} strokeWidth={1.2} />
          <Path d="M101 294 Q150 299 199 294 L206 318 Q150 324 94 318 Z" fill="url(#mobGlassGrad)" stroke={c.border} strokeWidth={1.2} />
          <Path d="M88 158 L94 176 L94 288 L88 308 Z" fill="url(#mobGlassGrad)" opacity={0.6} />
          <Path d="M212 158 L206 176 L206 288 L212 308 Z" fill="url(#mobGlassGrad)" opacity={0.6} />
          <Line x1={48} y1={192} x2={48} y2={206} stroke={c.border} strokeWidth={2} strokeLinecap="round" />
          <Line x1={48} y1={278} x2={48} y2={292} stroke={c.border} strokeWidth={2} strokeLinecap="round" />
          <Line x1={252} y1={192} x2={252} y2={206} stroke={c.border} strokeWidth={2} strokeLinecap="round" />
          <Line x1={252} y1={278} x2={252} y2={292} stroke={c.border} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <View style={[styles.axisPill, { borderColor: c.border, backgroundColor: c.surface, marginTop: 6 }]}>
          <Text variant="small" tone="subtle" style={styles.axisLabel}>ARKA</Text>
        </View>
        {!readOnly ? (
          <Text variant="caption" tone="muted" center style={{ marginTop: space.xs }}>
            {activeBrushSpec ? `Dokunduğunuz parça "${activeBrushSpec.label}" olur` : 'Parçaya dokunarak durumu değiştirin'}
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
          const isChanged = stateKey !== 'orijinal';

          if (readOnly) {
            return (
              <View
                key={part.id}
                style={[
                  styles.partRow,
                  {
                    borderColor: c.border,
                    backgroundColor: isChanged ? c.elevated : c.surface,
                  },
                ]}
              >
                <Text variant="caption" tone={isChanged ? 'default' : 'muted'} numberOfLines={1} style={[styles.partLabel, isChanged && styles.changedText]}>
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
              onPress={() => handlePartPress(part.id)}
              style={[
                styles.partRow,
                {
                  borderColor: isSelected ? c.primary : c.border,
                  backgroundColor: isSelected ? c.primarySoft : isChanged ? c.elevated : c.surface,
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
        <View style={styles.tramerEditWrap}>
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
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange?.({ ...value, tramer: value.tramer === 0 ? null : 0 })}
            style={[
              styles.tramerQuickChip,
              value.tramer === 0
                ? { borderColor: orijinalPal.badgeBorder, backgroundColor: orijinalPal.badgeBg }
                : { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Text variant="caption" style={{ fontWeight: '600', color: value.tramer === 0 ? orijinalPal.text : c.fg }}>
              Tramer Yok (0 ₺)
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  flexOne: { flex: 1 },
  summaryBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  summaryBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSection: { gap: space.sm },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  brushHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
    maxWidth: 244,
    marginBottom: 6,
  },
  axisPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  changedText: { fontWeight: '600' },
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
  tramerEditWrap: { gap: space.sm },
  tramerQuickChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
