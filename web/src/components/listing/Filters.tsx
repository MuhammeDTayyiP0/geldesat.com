import { TURKEY_CITIES } from "@/lib/data/locations";
import { NEIGHBORHOODS } from "@/lib/data/geo";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeFilterRanges } from "@/lib/search-params";
import type { AttrDef } from "@/lib/server/helpers";

export type FilterState = {
  category?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  minYear?: string;
  maxYear?: string;
  minKm?: string;
  maxKm?: string;
  minM2?: string;
  maxM2?: string;
  urgent?: string;
  featured?: string;
  postedWithin?: "1" | "3" | "7" | "30";
  withPhotos?: string;
  sellerType?: "owner" | "store";
  priceDropped?: string;
  attrs: Record<string, string[]>;
};

export function Filters({
  value,
  onChange,
  onApply,
  attributes = [],
  hideApplyButton = false,
  hideSort = false,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  onApply: (value: FilterState) => void;
  attributes?: AttrDef[];
  hideApplyButton?: boolean;
  hideSort?: boolean;
}) {
  const city = TURKEY_CITIES.find((c) => c.name === value.city);
  const districts = city?.districts ?? [];
  const neighborhoods = (value.city && value.district && NEIGHBORHOODS[value.city]?.[value.district]) || [];
  const hasVehicle = attributes.some((a) => a.id === "yil" || a.id === "km" || a.name === "Yıl" || a.name === "KM");
  const hasM2 = attributes.some((a) => a.id === "m2" || a.unit === "m²" || a.name.includes("m²"));

  function set<K extends keyof FilterState>(key: K, v: FilterState[K]) {
    onChange({ ...value, [key]: v });
  }

  function applyChecked() {
    const next = normalizeFilterRanges(value);
    if (next !== value) onChange(next);
    onApply(next);
  }

  function toggleAttr(name: string, opt: string, on: boolean) {
    const cur = value.attrs[name] ?? [];
    const next = on ? [...cur, opt] : cur.filter((x) => x !== opt);
    onChange({ ...value, attrs: { ...value.attrs, [name]: next } });
  }

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
      aria-label="Filtreler"
      onSubmit={(e) => {
        e.preventDefault();
        applyChecked();
      }}
    >
      <div>
        <Label htmlFor="filtre-il" className="text-xs font-semibold uppercase tracking-wider text-muted">İl</Label>
        <Select
          id="filtre-il"
          value={value.city ?? ""}
          onChange={(e) => onChange({ ...value, city: e.target.value || undefined, district: undefined, neighborhood: undefined })}
        >
          <option value="">Tüm iller</option>
          {TURKEY_CITIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="filtre-ilce" className="text-xs font-semibold uppercase tracking-wider text-muted">İlçe</Label>
        <Select
          id="filtre-ilce"
          value={value.district ?? ""}
          disabled={!value.city}
          onChange={(e) => onChange({ ...value, district: e.target.value || undefined, neighborhood: undefined })}
        >
          <option value="">Tüm ilçeler</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>

      {value.district ? (
        <div>
          <Label htmlFor="filtre-mahalle" className="text-xs font-semibold uppercase tracking-wider text-muted">Mahalle</Label>
          {neighborhoods.length > 0 ? (
            <Select
              id="filtre-mahalle"
              value={value.neighborhood ?? ""}
              onChange={(e) => set("neighborhood", e.target.value || undefined)}
            >
              <option value="">Tüm mahalleler</option>
              {neighborhoods.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="filtre-mahalle"
              type="text"
              placeholder="Mahalle adı yazın..."
              value={value.neighborhood ?? ""}
              onChange={(e) => set("neighborhood", e.target.value.trimStart() || undefined)}
            />
          )}
        </div>
      ) : null}

      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted">Fiyat (TL)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="En Az"
            aria-label="En az fiyat"
            value={value.minPrice ?? ""}
            onChange={(e) => set("minPrice", e.target.value)}
          />
          <Input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="En Çok"
            aria-label="En çok fiyat"
            value={value.maxPrice ?? ""}
            onChange={(e) => set("maxPrice", e.target.value)}
          />
        </div>
      </div>

      {hasVehicle ? (
        <>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted">Yıl</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Min Yıl"
              aria-label="En az yıl"
                value={value.minYear ?? ""}
                onChange={(e) => set("minYear", e.target.value)}
              />
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Max Yıl"
              aria-label="En çok yıl"
                value={value.maxYear ?? ""}
                onChange={(e) => set("maxYear", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted">Kilometre (KM)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Min KM"
              aria-label="En az kilometre"
                value={value.minKm ?? ""}
                onChange={(e) => set("minKm", e.target.value)}
              />
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Max KM"
              aria-label="En çok kilometre"
                value={value.maxKm ?? ""}
                onChange={(e) => set("maxKm", e.target.value)}
              />
            </div>
          </div>
        </>
      ) : null}

      {hasM2 ? (
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted">Metrekare (m²)</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Min m²"
              aria-label="En az metrekare"
              value={value.minM2 ?? ""}
              onChange={(e) => set("minM2", e.target.value)}
            />
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Max m²"
              aria-label="En çok metrekare"
              value={value.maxM2 ?? ""}
              onChange={(e) => set("maxM2", e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {attributes.filter((a) => a.type === "SELECT").length > 0 ? (
        <details open className="group rounded-xl border border-border p-3 transition-all">
          <summary className="cursor-pointer select-none text-sm font-semibold text-fg">Özellikler</summary>
          <div className="mt-3 space-y-3">
            {attributes
              .filter((a) => a.type === "SELECT")
              .map((a) => (
                <div key={a.id} className="border-t border-border/50 pt-2.5 first:border-none first:pt-0">
                  <Label className="text-xs font-medium text-muted">{a.name}</Label>
                  <div className="mt-1.5 space-y-1.5">
                    {(a.options ?? []).map((opt) => {
                      const checked = (value.attrs[a.name] ?? []).includes(opt);
                      return (
                        <label key={opt} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-fg transition-colors hover:text-primary">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border accent-primary"
                            checked={checked}
                            onChange={(e) => toggleAttr(a.name, opt, e.target.checked)}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </details>
      ) : null}

      {attributes.filter((a) => a.type === "MULTI").length > 0 ? (
        <details className="group rounded-xl border border-border p-3 transition-all">
          <summary className="cursor-pointer select-none text-sm font-semibold text-fg">Donanım / Ek Özellikler</summary>
          <div className="mt-3 space-y-3">
            {attributes
              .filter((a) => a.type === "MULTI")
              .map((a) => (
                <div key={a.id} className="border-t border-border/50 pt-2.5 first:border-none first:pt-0">
                  <Label className="text-xs font-medium text-muted">{a.name}</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(a.options ?? []).map((opt) => {
                      const checked = (value.attrs[a.name] ?? []).includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          aria-pressed={checked}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            checked
                              ? "border-primary bg-primary-solid text-primary-fg"
                              : "border-border bg-surface text-fg hover:border-primary/50"
                          }`}
                          onClick={() => toggleAttr(a.name, opt, !checked)}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </details>
      ) : null}

      {attributes.filter((a) => a.type === "BOOLEAN").length > 0 ? (
        <details className="group rounded-xl border border-border p-3 transition-all">
          <summary className="cursor-pointer select-none text-sm font-semibold text-fg">Seçenekler</summary>
          <div className="mt-3 space-y-2 text-sm">
            {attributes
              .filter((a) => a.type === "BOOLEAN")
              .map((a) => {
                const opt = (a.options ?? ["Evet"])[0];
                const checked = (value.attrs[a.name] ?? []).includes(opt);
                return (
                  <label key={a.id} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-fg transition-colors hover:text-primary">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border accent-primary"
                      checked={checked}
                      onChange={(e) => toggleAttr(a.name, opt, e.target.checked)}
                    />
                    <span>{a.name}</span>
                  </label>
                );
              })}
          </div>
        </details>
      ) : null}

      <div>
        <Label htmlFor="filtre-tarih" className="text-xs font-semibold uppercase tracking-wider text-muted">İlan Tarihi</Label>
        <Select
          id="filtre-tarih"
          value={value.postedWithin ?? ""}
          onChange={(e) => set("postedWithin", (e.target.value || undefined) as FilterState["postedWithin"])}
        >
          <option value="">Tüm tarihler</option>
          <option value="1">Son 24 saat</option>
          <option value="3">Son 3 gün</option>
          <option value="7">Son 7 gün</option>
          <option value="30">Son 30 gün</option>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted">Kimden</Label>
        <div role="group" aria-label="Satıcı tipi" className="mt-1 grid grid-cols-3 rounded-lg bg-elevated p-0.5 text-xs">
          {(
            [
              { value: undefined, label: "Tümü" },
              { value: "owner", label: "Sahibinden" },
              { value: "store", label: "Mağazadan" },
            ] as const
          ).map((opt) => {
            const active = (value.sellerType ?? undefined) === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                aria-pressed={active}
                onClick={() => set("sellerType", opt.value)}
                className={cn(
                  "h-8 rounded-md px-2 font-medium transition-colors",
                  active ? "bg-surface text-fg shadow-2xs" : "text-muted hover:text-fg",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5 rounded-xl border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Hızlı Seçenekler</p>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-fg transition-colors hover:text-primary">
          <input
            type="checkbox"
            className="size-4 rounded border-border accent-primary"
            checked={value.urgent === "1"}
            onChange={(e) => set("urgent", e.target.checked ? "1" : undefined)}
          />
          <span>Yalnızca acil ilanlar</span>
        </label>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-fg transition-colors hover:text-primary">
          <input
            type="checkbox"
            className="size-4 rounded border-border accent-primary"
            checked={value.featured === "1"}
            onChange={(e) => set("featured", e.target.checked ? "1" : undefined)}
          />
          <span>Yalnızca vitrin ilanları</span>
        </label>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-fg transition-colors hover:text-primary">
          <input
            type="checkbox"
            className="size-4 rounded border-border accent-primary"
            checked={value.withPhotos === "1"}
            onChange={(e) => set("withPhotos", e.target.checked ? "1" : undefined)}
          />
          <span>Sadece fotoğraflı</span>
        </label>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-fg transition-colors hover:text-primary">
          <input
            type="checkbox"
            className="size-4 rounded border-border accent-primary"
            checked={value.priceDropped === "1"}
            onChange={(e) => set("priceDropped", e.target.checked ? "1" : undefined)}
          />
          <span>Fiyatı düşenler</span>
        </label>
      </div>

      {!hideSort ? (
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted">Sıralama</Label>
          <Select value={value.sort ?? "date_desc"} onChange={(e) => set("sort", e.target.value)}>
            <option value="date_desc">En Yeni İlanlar</option>
            <option value="date_asc">En Eski İlanlar</option>
            <option value="price_asc">Fiyat: Düşükten Yükseğe</option>
            <option value="price_desc">Fiyat: Yüksekten Düşüğe</option>
            <option value="views_desc">En Çok İncelenenler</option>
          </Select>
        </div>
      ) : null}

      {!hideApplyButton ? (
        <Button type="submit" className="h-11 w-full text-sm font-semibold">
          Filtreleri Uygula
        </Button>
      ) : null}
    </form>
  );
}
