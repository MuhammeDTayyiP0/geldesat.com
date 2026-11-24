import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn, formatNumber, formatPrice } from "@/lib/utils";

export type DamagePartState = "orijinal" | "lokal" | "boyali" | "degisen";

export type DamagePartId =
  | "on_tampon"
  | "kaput"
  | "tavan"
  | "bagaj"
  | "arka_tampon"
  | "sol_on_camurluk"
  | "sol_on_kapi"
  | "sol_arka_kapi"
  | "sol_arka_camurluk"
  | "sag_on_camurluk"
  | "sag_on_kapi"
  | "sag_arka_kapi"
  | "sag_arka_camurluk";

export type VehicleDamageData = {
  parts: Record<DamagePartId, DamagePartState>;
  tramer: number | null;
};

export const DAMAGE_PARTS: ReadonlyArray<{ id: DamagePartId; label: string; shortLabel: string }> = [
  { id: "on_tampon", label: "Ön Tampon", shortLabel: "Ön Tampon" },
  { id: "kaput", label: "Kaput", shortLabel: "Kaput" },
  { id: "tavan", label: "Tavan", shortLabel: "Tavan" },
  { id: "bagaj", label: "Bagaj", shortLabel: "Bagaj" },
  { id: "arka_tampon", label: "Arka Tampon", shortLabel: "Arka Tampon" },
  { id: "sol_on_camurluk", label: "Sol Ön Çamurluk", shortLabel: "Sol Ön Çam." },
  { id: "sol_on_kapi", label: "Sol Ön Kapı", shortLabel: "Sol Ön Kapı" },
  { id: "sol_arka_kapi", label: "Sol Arka Kapı", shortLabel: "Sol Arka Kapı" },
  { id: "sol_arka_camurluk", label: "Sol Arka Çamurluk", shortLabel: "Sol Arka Çam." },
  { id: "sag_on_camurluk", label: "Sağ Ön Çamurluk", shortLabel: "Sağ Ön Çam." },
  { id: "sag_on_kapi", label: "Sağ Ön Kapı", shortLabel: "Sağ Ön Kapı" },
  { id: "sag_arka_kapi", label: "Sağ Arka Kapı", shortLabel: "Sağ Arka Kapı" },
  { id: "sag_arka_camurluk", label: "Sağ Arka Çamurluk", shortLabel: "Sağ Arka Çam." },
];

export const DAMAGE_STATES: ReadonlyArray<{
  key: DamagePartState;
  code: string;
  label: string;
  badgeClass: string;
  dotClass: string;
  svgFill: string;
  svgStroke: string;
}> = [
  {
    key: "orijinal",
    code: "0",
    label: "Orijinal",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    svgFill: "fill-emerald-500/15 hover:fill-emerald-500/25",
    svgStroke: "stroke-emerald-600/55 dark:stroke-emerald-400/60",
  },
  {
    key: "lokal",
    code: "1",
    label: "Lokal Boyalı",
    badgeClass: "border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
    svgFill: "fill-amber-500/35 hover:fill-amber-500/45",
    svgStroke: "stroke-amber-600 dark:stroke-amber-400",
  },
  {
    key: "boyali",
    code: "2",
    label: "Boyalı",
    badgeClass: "border-blue-500/35 bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dotClass: "bg-blue-500",
    svgFill: "fill-blue-500/35 hover:fill-blue-500/45",
    svgStroke: "stroke-blue-600 dark:stroke-blue-400",
  },
  {
    key: "degisen",
    code: "3",
    label: "Değişen",
    badgeClass: "border-rose-500/35 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dotClass: "bg-rose-500",
    svgFill: "fill-rose-500/35 hover:fill-rose-500/45",
    svgStroke: "stroke-rose-600 dark:stroke-rose-400",
  },
];

const STATE_BY_KEY = new Map(DAMAGE_STATES.map((s) => [s.key, s]));
const STATE_BY_CODE = new Map(DAMAGE_STATES.map((s) => [s.code, s.key]));
const NEXT_STATE: Record<DamagePartState, DamagePartState> = {
  orijinal: "lokal",
  lokal: "boyali",
  boyali: "degisen",
  degisen: "orijinal",
};

export function createEmptyDamageData(): VehicleDamageData {
  const parts = {} as Record<DamagePartId, DamagePartState>;
  for (const part of DAMAGE_PARTS) parts[part.id] = "orijinal";
  return { parts, tramer: null };
}

/** Parses either the compact `{ p, t }` format or verbose `{ parts, tramer }` JSON. */
export function parseDamageValue(raw: unknown): VehicleDamageData {
  const empty = createEmptyDamageData();
  if (typeof raw !== "string" || !raw.trim()) return empty;
  try {
    const parsed = JSON.parse(raw) as {
      p?: unknown;
      t?: unknown;
      parts?: Record<string, unknown>;
      tramer?: unknown;
    };
    if (!parsed || typeof parsed !== "object") return empty;

    if (typeof parsed.p === "string") {
      DAMAGE_PARTS.forEach((part, idx) => {
        const mapped = STATE_BY_CODE.get(parsed.p?.toString().charAt(idx) ?? "0");
        if (mapped) empty.parts[part.id] = mapped;
      });
    } else if (parsed.parts && typeof parsed.parts === "object") {
      for (const part of DAMAGE_PARTS) {
        const val = parsed.parts[part.id];
        if (typeof val === "string" && STATE_BY_KEY.has(val as DamagePartState)) {
          empty.parts[part.id] = val as DamagePartState;
        }
      }
    }

    const rawTramer = parsed.t !== undefined ? parsed.t : parsed.tramer;
    if (typeof rawTramer === "number" && Number.isFinite(rawTramer) && rawTramer >= 0) {
      empty.tramer = Math.round(rawTramer);
    }
    return empty;
  } catch {
    return empty;
  }
}

/**
 * Serializes into a compact JSON string (`<= 50` chars) so it fits strict
 * attribute value limits while encoding all 13 parts and optional tramer.
 * Returns `""` when every part is original and no tramer value was entered.
 */
export function serializeDamageValue(data: VehicleDamageData): string {
  const hasNonOriginal = DAMAGE_PARTS.some((p) => data.parts[p.id] && data.parts[p.id] !== "orijinal");
  const hasTramer = typeof data.tramer === "number" && Number.isFinite(data.tramer) && data.tramer >= 0;
  if (!hasNonOriginal && !hasTramer) return "";

  const codes = DAMAGE_PARTS.map((p) => STATE_BY_KEY.get(data.parts[p.id] ?? "orijinal")?.code ?? "0").join("");
  const payload: { p: string; t?: number } = { p: codes };
  if (hasTramer) payload.t = Math.round(data.tramer as number);
  return JSON.stringify(payload);
}

/** True when serialized damage or tramer information is present. */
export function hasDamageData(raw: unknown): boolean {
  if (typeof raw !== "string" || !raw.trim()) return false;
  const parsed = parseDamageValue(raw);
  return DAMAGE_PARTS.some((p) => parsed.parts[p.id] !== "orijinal") || parsed.tramer !== null;
}

/** Derives summary counts per state across the 13 body panels. */
export function summarizeDamage(data: VehicleDamageData): Record<DamagePartState, number> {
  const counts: Record<DamagePartState, number> = { orijinal: 0, lokal: 0, boyali: 0, degisen: 0 };
  for (const part of DAMAGE_PARTS) {
    counts[data.parts[part.id] ?? "orijinal"] += 1;
  }
  return counts;
}

type SvgPartShape = {
  id: DamagePartId;
  d: string;
  labelX: number;
  labelY: number;
  rotate?: number;
};

const SVG_SHAPES: ReadonlyArray<SvgPartShape> = [
  // Center spine (front at top -> rear at bottom)
  { id: "on_tampon", d: "M76 28 Q140 8 204 28 L198 48 Q140 36 82 48 Z", labelX: 140, labelY: 32 },
  { id: "kaput", d: "M82 52 Q140 42 198 52 L192 126 L88 126 Z", labelX: 140, labelY: 90 },
  { id: "tavan", d: "M88 156 L192 156 L192 268 L88 268 Z", labelX: 140, labelY: 214 },
  { id: "bagaj", d: "M88 294 L192 294 L198 352 Q140 362 82 352 Z", labelX: 140, labelY: 326 },
  { id: "arka_tampon", d: "M78 358 Q140 368 202 358 L206 378 Q140 394 74 378 Z", labelX: 140, labelY: 376 },

  // Left side (Sol)
  { id: "sol_on_camurluk", d: "M42 54 Q60 48 76 52 L82 128 L42 128 Z", labelX: 60, labelY: 92, rotate: -90 },
  { id: "sol_on_kapi", d: "M42 134 L82 134 L82 210 L42 210 Z", labelX: 62, labelY: 172, rotate: -90 },
  { id: "sol_arka_kapi", d: "M42 216 L82 216 L82 290 L42 290 Z", labelX: 62, labelY: 253, rotate: -90 },
  { id: "sol_arka_camurluk", d: "M42 296 L82 296 L76 352 Q56 356 42 346 Z", labelX: 60, labelY: 324, rotate: -90 },

  // Right side (Sağ)
  { id: "sag_on_camurluk", d: "M204 52 Q220 48 238 54 L238 128 L198 128 Z", labelX: 220, labelY: 92, rotate: 90 },
  { id: "sag_on_kapi", d: "M198 134 L238 134 L238 210 L198 210 Z", labelX: 218, labelY: 172, rotate: 90 },
  { id: "sag_arka_kapi", d: "M198 216 L238 216 L238 290 L198 290 Z", labelX: 218, labelY: 253, rotate: 90 },
  { id: "sag_arka_camurluk", d: "M198 296 L238 296 L238 346 Q224 356 204 352 Z", labelX: 220, labelY: 324, rotate: 90 },
];

const PART_BY_ID = new Map(DAMAGE_PARTS.map((p) => [p.id, p]));

export function VehicleDamageDiagram({
  value,
  onChange,
  readOnly = false,
  className,
}: {
  value: VehicleDamageData;
  onChange?: (next: VehicleDamageData) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const [selectedPart, setSelectedPart] = useState<DamagePartId>("kaput");
  const counts = summarizeDamage(value);
  const activePart = PART_BY_ID.get(selectedPart) ?? DAMAGE_PARTS[0];
  const activeState = value.parts[selectedPart] ?? "orijinal";

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
    const cur = value.parts[id] ?? "orijinal";
    updatePart(id, NEXT_STATE[cur]);
  }

  function resetAll() {
    if (readOnly || !onChange) return;
    onChange(createEmptyDamageData());
  }

  const changedParts = DAMAGE_PARTS.filter((p) => value.parts[p.id] !== "orijinal");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Legend + summary */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {DAMAGE_STATES.map((s) => (
            <span
              key={s.key}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", s.badgeClass)}
            >
              <span className={cn("size-2 rounded-full", s.dotClass)} aria-hidden="true" />
              {s.label}
              <span className="tabular-nums opacity-80">({counts[s.key]})</span>
            </span>
          ))}
        </div>
        {!readOnly && (changedParts.length > 0 || value.tramer !== null) ? (
          <Button type="button" variant="ghost" size="sm" onClick={resetAll} className="h-7 px-2 text-xs text-muted">
            <RotateCcw className="size-3.5" /> Sıfırla
          </Button>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
        {/* Top-down 13-part SVG vehicle diagram */}
        <div className="flex flex-col items-center rounded-xl border border-border bg-elevated/40 p-3">
          <div className="mb-1 flex w-full max-w-[230px] items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-subtle">
            <span>Sol</span>
            <span>Ön</span>
            <span>Sağ</span>
          </div>
          <svg
            viewBox="0 0 280 404"
            className="h-auto w-full max-w-[230px] select-none"
            role="img"
            aria-label="Araç boya ve değişen şeması"
          >
            {/* Windshield & rear glass decorative guides */}
            <path d="M90 130 L190 130 L184 152 L96 152 Z" className="fill-border/35 stroke-border" strokeWidth="1.2" />
            <path d="M96 272 L184 272 L190 290 L90 290 Z" className="fill-border/35 stroke-border" strokeWidth="1.2" />
            {/* Side mirrors */}
            <ellipse cx="34" cy="136" rx="7" ry="4" className="fill-border/50 stroke-border" strokeWidth="1" />
            <ellipse cx="246" cy="136" rx="7" ry="4" className="fill-border/50 stroke-border" strokeWidth="1" />

            {SVG_SHAPES.map((shape) => {
              const part = PART_BY_ID.get(shape.id)!;
              const stateKey = value.parts[shape.id] ?? "orijinal";
              const st = STATE_BY_KEY.get(stateKey) ?? DAMAGE_STATES[0];
              const isSelected = !readOnly && selectedPart === shape.id;
              const shortTag =
                stateKey === "orijinal"
                  ? ""
                  : stateKey === "lokal"
                    ? "Lokal"
                    : stateKey === "boyali"
                      ? "Boyalı"
                      : "Değişen";

              return (
                <g
                  key={shape.id}
                  role={readOnly ? undefined : "button"}
                  tabIndex={readOnly ? undefined : 0}
                  aria-label={`${part.label}: ${st.label}`}
                  onClick={() => !readOnly && cyclePart(shape.id)}
                  onKeyDown={(e) => {
                    if (!readOnly && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      cyclePart(shape.id);
                    }
                  }}
                  className={cn(readOnly ? "cursor-default" : "cursor-pointer outline-none")}
                >
                  <path
                    d={shape.d}
                    className={cn("transition-colors", st.svgFill, st.svgStroke)}
                    strokeWidth={isSelected ? 2.4 : 1.5}
                    strokeLinejoin="round"
                  />
                  {shortTag ? (
                    <text
                      x={shape.labelX}
                      y={shape.labelY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={shape.rotate ? `rotate(${shape.rotate} ${shape.labelX} ${shape.labelY})` : undefined}
                      className="pointer-events-none fill-fg text-[9px] font-bold"
                    >
                      {shortTag}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Arka</span>
          {!readOnly ? (
            <p className="mt-2 text-center text-[11px] text-muted">Parçaya tıklayarak durumu değiştirin</p>
          ) : null}
        </div>

        {/* Right column: part controls/list + Tramer */}
        <div className="space-y-4">
          {!readOnly ? (
            <div className="rounded-xl border border-border bg-elevated/35 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-fg">
                  Seçili parça: <span className="text-primary">{activePart.label}</span>
                </p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${activePart.label} durumu`}>
                  {DAMAGE_STATES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      role="radio"
                      aria-checked={activeState === s.key}
                      onClick={() => updatePart(activePart.id, s.key)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        activeState === s.key
                          ? cn(s.badgeClass, "ring-2 ring-primary/20")
                          : "border-border bg-surface text-muted hover:text-fg",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {DAMAGE_PARTS.map((part) => {
              const stateKey = value.parts[part.id] ?? "orijinal";
              const st = STATE_BY_KEY.get(stateKey) ?? DAMAGE_STATES[0];
              if (readOnly) {
                return (
                  <div
                    key={part.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate text-muted">{part.label}</span>
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", st.badgeClass)}>
                      {st.label}
                    </span>
                  </div>
                );
              }
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => cyclePart(part.id)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                    selectedPart === part.id ? "border-primary/50 bg-primary/5" : "border-border hover:bg-elevated/60",
                  )}
                >
                  <span className="truncate font-medium text-fg">{part.label}</span>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", st.badgeClass)}>
                    {st.label}
                  </span>
                </button>
              );
            })}
          </div>

          {readOnly ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-elevated/40 px-3.5 py-2.5 text-sm">
              <span className="font-medium text-muted">Tramer / Hasar Kaydı Tutarı</span>
              <span className="font-semibold tabular-nums text-fg">
                {value.tramer === null ? "Belirtilmedi" : value.tramer === 0 ? "0 ₺ (Yok)" : formatPrice(value.tramer, "TRY")}
              </span>
            </div>
          ) : (
            <div className="sm:max-w-xs">
              <Label htmlFor="vehicle-tramer-input">Tramer Tutarı (TL, isteğe bağlı)</Label>
              <div className="relative">
                <Input
                  id="vehicle-tramer-input"
                  inputMode="numeric"
                  autoComplete="off"
                  value={value.tramer !== null ? formatNumber(value.tramer) : ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                    if (!onChange) return;
                    onChange({
                      ...value,
                      tramer: digits === "" ? null : Number(digits),
                    });
                  }}
                  placeholder="Örn. 15.000 veya 0"
                  className="pr-10 tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs font-semibold text-muted">
                  TL
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
