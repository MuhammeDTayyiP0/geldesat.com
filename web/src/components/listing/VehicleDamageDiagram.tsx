import { useId, useState } from "react";
import { CheckCircle2, Paintbrush, RotateCcw, ShieldCheck } from "lucide-react";
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
  // Center spine (front at top -> rear at bottom), viewBox 0 0 300 440
  { id: "on_tampon", d: "M74 34 Q150 8 226 34 L217 56 Q150 42 83 56 Z", labelX: 150, labelY: 36 },
  { id: "kaput", d: "M84 61 Q150 48 216 61 L207 137 Q150 132 93 137 Z", labelX: 150, labelY: 98 },
  { id: "tavan", d: "M96 174 Q150 169 204 174 L204 289 Q150 294 96 289 Z", labelX: 150, labelY: 232 },
  { id: "bagaj", d: "M93 322 Q150 327 207 322 L216 382 Q150 394 84 382 Z", labelX: 150, labelY: 356 },
  { id: "arka_tampon", d: "M78 388 Q150 400 222 388 L226 410 Q150 430 74 410 Z", labelX: 150, labelY: 408 },

  // Left side (Sol)
  { id: "sol_on_camurluk", d: "M46 62 Q62 52 79 59 L86 138 L44 138 Q41 98 46 62 Z", labelX: 64, labelY: 100, rotate: -90 },
  { id: "sol_on_kapi", d: "M44 144 L87 144 L87 224 L44 224 Z", labelX: 65, labelY: 184, rotate: -90 },
  { id: "sol_arka_kapi", d: "M44 230 L87 230 L87 314 L44 314 Z", labelX: 65, labelY: 272, rotate: -90 },
  { id: "sol_arka_camurluk", d: "M44 320 L87 320 L79 382 Q60 388 46 375 Q41 348 44 320 Z", labelX: 64, labelY: 352, rotate: -90 },

  // Right side (Sağ)
  { id: "sag_on_camurluk", d: "M221 59 Q238 52 254 62 Q259 98 256 138 L214 138 Z", labelX: 236, labelY: 100, rotate: 90 },
  { id: "sag_on_kapi", d: "M213 144 L256 144 L256 224 L213 224 Z", labelX: 235, labelY: 184, rotate: 90 },
  { id: "sag_arka_kapi", d: "M213 230 L256 230 L256 314 L213 314 Z", labelX: 235, labelY: 272, rotate: 90 },
  { id: "sag_arka_camurluk", d: "M213 320 L256 320 Q259 348 254 375 Q240 388 221 382 Z", labelX: 236, labelY: 352, rotate: 90 },
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
  const [activeBrush, setActiveBrush] = useState<DamagePartState | null>(null);
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

  function handlePartPress(id: DamagePartId) {
    if (readOnly || !onChange) return;
    setSelectedPart(id);
    const cur = value.parts[id] ?? "orijinal";
    if (activeBrush) {
      const next = cur === activeBrush && activeBrush !== "orijinal" ? "orijinal" : activeBrush;
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

  const svgUid = useId().replace(/:/g, "");
  const shadowGradId = `carShadow-${svgUid}`;
  const glassGradId = `glassGrad-${svgUid}`;
  const changedParts = DAMAGE_PARTS.filter((p) => value.parts[p.id] !== "orijinal");
  const isCleanCar = changedParts.length === 0;
  const activeBrushSpec = activeBrush ? STATE_BY_KEY.get(activeBrush) : undefined;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Read-only summary banner */}
      {readOnly ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium",
            isCleanCar
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-border bg-elevated/45 text-fg",
          )}
        >
          <div className="flex items-center gap-2">
            {isCleanCar ? <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : null}
            <span>
              {isCleanCar
                ? "Tamamı Orijinal (Boyasız / Değişensiz)"
                : [
                    counts.degisen ? `${counts.degisen} Değişen` : null,
                    counts.boyali ? `${counts.boyali} Boyalı` : null,
                    counts.lokal ? `${counts.lokal} Lokal Boyalı` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </span>
          </div>
          {value.tramer !== null ? (
            <span className="tabular-nums text-muted">
              Tramer: <strong className="text-fg">{value.tramer === 0 ? "Yok (0 ₺)" : formatPrice(value.tramer, "TRY")}</strong>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Legend / Interactive Brush + Quick Presets */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {DAMAGE_STATES.map((s) => {
              const isBrush = !readOnly && activeBrush === s.key;
              if (readOnly) {
                return (
                  <span
                    key={s.key}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", s.badgeClass)}
                  >
                    <span className={cn("size-2 rounded-full", s.dotClass)} aria-hidden="true" />
                    {s.label}
                    <span className="tabular-nums opacity-80">({counts[s.key]})</span>
                  </span>
                );
              }
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={isBrush}
                  onClick={() => setActiveBrush((prev) => (prev === s.key ? null : s.key))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                    s.badgeClass,
                    isBrush ? "ring-2 ring-primary ring-offset-1 ring-offset-surface" : "opacity-85 hover:opacity-100",
                  )}
                >
                  <span className={cn("size-2 rounded-full", s.dotClass)} aria-hidden="true" />
                  {s.label}
                  <span className="tabular-nums opacity-80">({counts[s.key]})</span>
                </button>
              );
            })}
          </div>
          {!readOnly ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyCleanPreset}
                className={cn(
                  "h-7 px-2.5 text-xs",
                  isCleanCar && value.tramer === 0 && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                )}
              >
                <CheckCircle2 className="size-3.5" /> Tamamı Orijinal · Tramer Yok
              </Button>
              {changedParts.length > 0 || value.tramer !== null ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetAll} className="h-7 px-2 text-xs text-muted">
                  <RotateCcw className="size-3.5" /> Sıfırla
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {!readOnly ? (
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <Paintbrush className="size-3 shrink-0 text-primary" aria-hidden="true" />
            {activeBrushSpec ? (
              <span>
                Hızlı işaretleme fırçası: <strong className="text-fg">{activeBrushSpec.label}</strong> — dokunduğunuz parça bu duruma geçer.
              </span>
            ) : (
              <span>Hızlı işaretleme fırçası için yukarıdaki bir duruma tıklayın ya da doğrudan parçaya tıklayarak değiştirin.</span>
            )}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
        {/* Top-down 13-part SVG vehicle diagram */}
        <div className="flex flex-col items-center rounded-2xl border border-border bg-elevated/45 p-3.5">
          <div className="mb-1.5 flex w-full max-w-[244px] items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-subtle">
            <span className="rounded-full border border-border/70 bg-surface px-2 py-0.5">Sol</span>
            <span className="rounded-full border border-border/70 bg-surface px-2.5 py-0.5 text-fg">Ön</span>
            <span className="rounded-full border border-border/70 bg-surface px-2 py-0.5">Sağ</span>
          </div>
          <svg
            viewBox="0 0 300 440"
            className="h-auto w-full max-w-[244px] select-none"
            role={readOnly ? "img" : "group"}
            aria-label="Araç boya ve değişen şeması"
          >
            <defs>
              <radialGradient id={shadowGradId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0f172a" stopOpacity="0.22" />
                <stop offset="70%" stopColor="#0f172a" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={glassGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#334155" stopOpacity="0.48" />
                <stop offset="50%" stopColor="#1e293b" stopOpacity="0.62" />
                <stop offset="100%" stopColor="#475569" stopOpacity="0.42" />
              </linearGradient>
            </defs>

            {/* Soft ground drop shadow */}
            <ellipse cx="150" cy="226" rx="126" ry="204" fill={`url(#${shadowGradId})`} />

            {/* Wheels / tires */}
            <g>
              <rect x="30" y="76" width="12" height="52" rx="5.5" className="fill-slate-800/80 stroke-border dark:fill-slate-700" strokeWidth="1" />
              <rect x="258" y="76" width="12" height="52" rx="5.5" className="fill-slate-800/80 stroke-border dark:fill-slate-700" strokeWidth="1" />
              <rect x="30" y="314" width="12" height="52" rx="5.5" className="fill-slate-800/80 stroke-border dark:fill-slate-700" strokeWidth="1" />
              <rect x="258" y="314" width="12" height="52" rx="5.5" className="fill-slate-800/80 stroke-border dark:fill-slate-700" strokeWidth="1" />
            </g>

            {/* Outer aerodynamic chassis silhouette */}
            <path
              d="M72 30 Q150 4 228 30 Q262 52 262 110 L262 346 Q262 396 228 412 Q150 434 72 412 Q38 396 38 346 L38 110 Q38 52 72 30 Z"
              className="fill-surface/55 stroke-border/70"
              strokeWidth="1.2"
            />

            {/* Headlights & LED DRLs */}
            <path d="M55 44 Q70 30 82 35 L75 49 Q63 47 53 52 Z" className="fill-amber-300/45 stroke-amber-500/70" strokeWidth="1.1" />
            <path d="M245 44 Q230 30 218 35 L225 49 Q237 47 247 52 Z" className="fill-amber-300/45 stroke-amber-500/70" strokeWidth="1.1" />
            {/* Taillights */}
            <path d="M54 388 Q66 396 80 393 L82 405 Q65 408 52 398 Z" className="fill-rose-500/45 stroke-rose-500/75" strokeWidth="1.1" />
            <path d="M246 388 Q234 396 220 393 L218 405 Q235 408 248 398 Z" className="fill-rose-500/45 stroke-rose-500/75" strokeWidth="1.1" />

            {/* Side mirrors */}
            <path d="M23 148 Q30 140 43 146 L43 156 Q31 159 23 152 Z" className="fill-surface stroke-border" strokeWidth="1.2" />
            <path d="M277 148 Q270 140 257 146 L257 156 Q269 159 277 152 Z" className="fill-surface stroke-border" strokeWidth="1.2" />

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
                  onClick={() => !readOnly && handlePartPress(shape.id)}
                  onKeyDown={(e) => {
                    if (!readOnly && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      handlePartPress(shape.id);
                    }
                  }}
                  className={cn(readOnly ? "cursor-default" : "cursor-pointer outline-none")}
                >
                  <path
                    d={shape.d}
                    className={cn("transition-colors", st.svgFill, isSelected ? "stroke-primary" : st.svgStroke)}
                    strokeWidth={isSelected ? 2.8 : 1.5}
                    strokeLinejoin="round"
                  />
                  {shortTag ? (
                    <g
                      transform={shape.rotate ? `rotate(${shape.rotate} ${shape.labelX} ${shape.labelY})` : undefined}
                      className="pointer-events-none"
                    >
                      <rect
                        x={shape.labelX - 24}
                        y={shape.labelY - 9}
                        width={48}
                        height={18}
                        rx={6}
                        className="fill-surface/90 stroke-border/60"
                        strokeWidth="0.7"
                      />
                      <text
                        x={shape.labelX}
                        y={shape.labelY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-fg text-[9px] font-bold"
                      >
                        {shortTag}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}

            {/* Decorative hood crease lines, panoramic roof & glass cabin (non-interactive) */}
            <g className="pointer-events-none">
              <path d="M108 72 L114 128" className="stroke-border/45" strokeWidth="1" strokeLinecap="round" />
              <path d="M192 72 L186 128" className="stroke-border/45" strokeWidth="1" strokeLinecap="round" />
              <rect x="108" y="186" width="84" height="86" rx="14" className="fill-none stroke-border/45" strokeWidth="1" strokeDasharray="3 3" />
              {/* Windshield & rear glass */}
              <path d="M94 140 Q150 132 206 140 L199 169 Q150 163 101 169 Z" fill={`url(#${glassGradId})`} className="stroke-border" strokeWidth="1.2" />
              <path d="M101 294 Q150 299 199 294 L206 318 Q150 324 94 318 Z" fill={`url(#${glassGradId})`} className="stroke-border" strokeWidth="1.2" />
              {/* Side window strips */}
              <path d="M88 158 L94 176 L94 288 L88 308 Z" fill={`url(#${glassGradId})`} opacity="0.6" />
              <path d="M212 158 L206 176 L206 288 L212 308 Z" fill={`url(#${glassGradId})`} opacity="0.6" />
              {/* Door handles */}
              <line x1="48" y1="192" x2="48" y2="206" className="stroke-border" strokeWidth="2" strokeLinecap="round" />
              <line x1="48" y1="278" x2="48" y2="292" className="stroke-border" strokeWidth="2" strokeLinecap="round" />
              <line x1="252" y1="192" x2="252" y2="206" className="stroke-border" strokeWidth="2" strokeLinecap="round" />
              <line x1="252" y1="278" x2="252" y2="292" className="stroke-border" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
          <span className="mt-1.5 rounded-full border border-border/70 bg-surface px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
            Arka
          </span>
          {!readOnly ? (
            <p className="mt-2 text-center text-[11px] text-muted">
              {activeBrushSpec ? `Dokunduğunuz parça "${activeBrushSpec.label}" olur` : "Parçaya tıklayarak durumu değiştirin"}
            </p>
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
              const isChanged = stateKey !== "orijinal";
              if (readOnly) {
                return (
                  <div
                    key={part.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                      isChanged ? "border-border bg-elevated/55" : "border-border/70",
                    )}
                  >
                    <span className={cn("truncate", isChanged ? "font-medium text-fg" : "text-muted")}>{part.label}</span>
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
                  onClick={() => handlePartPress(part.id)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                    selectedPart === part.id
                      ? "border-primary/50 bg-primary/5"
                      : isChanged
                        ? "border-border bg-elevated/35 hover:bg-elevated/60"
                        : "border-border hover:bg-elevated/60",
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
            <div className="space-y-2">
              <Label htmlFor="vehicle-tramer-input">Tramer Tutarı (TL, isteğe bağlı)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:max-w-xs">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange?.({ ...value, tramer: value.tramer === 0 ? null : 0 })}
                  className={cn(
                    "h-10 shrink-0 px-3 text-xs",
                    value.tramer === 0 && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  Tramer Yok (0 ₺)
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
