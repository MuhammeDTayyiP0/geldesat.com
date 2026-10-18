import { TURKEY_CITIES } from "@/lib/data/locations";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AttrDef } from "@/lib/server/helpers";

export type FilterState = {
  category?: string;
  city?: string;
  district?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  minYear?: string;
  maxYear?: string;
  minKm?: string;
  maxKm?: string;
  minM2?: string;
  maxM2?: string;
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
  onApply: () => void;
  attributes?: AttrDef[];
  hideApplyButton?: boolean;
  hideSort?: boolean;
}) {
  const city = TURKEY_CITIES.find((c) => c.name === value.city);
  const districts = city?.districts ?? [];
  const hasVehicle = attributes.some((a) => a.id === "yil" || a.id === "km" || a.name === "Yıl" || a.name === "KM");
  const hasM2 = attributes.some((a) => a.id === "m2" || a.unit === "m²" || a.name.includes("m²"));

  function set<K extends keyof FilterState>(key: K, v: FilterState[K]) {
    onChange({ ...value, [key]: v });
  }

  function toggleAttr(name: string, opt: string, on: boolean) {
    const cur = value.attrs[name] ?? [];
    const next = on ? [...cur, opt] : cur.filter((x) => x !== opt);
    onChange({ ...value, attrs: { ...value.attrs, [name]: next } });
  }

  return (
    <aside className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted">İl</Label>
        <Select
          value={value.city ?? ""}
          onChange={(e) => onChange({ ...value, city: e.target.value || undefined, district: undefined })}
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
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted">İlçe</Label>
        <Select
          value={value.district ?? ""}
          disabled={!value.city}
          onChange={(e) => onChange({ ...value, district: e.target.value || undefined })}
        >
          <option value="">Tüm ilçeler</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted">Fiyat (TL)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="En Az"
            value={value.minPrice ?? ""}
            onChange={(e) => set("minPrice", e.target.value)}
          />
          <Input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="En Çok"
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
                value={value.minYear ?? ""}
                onChange={(e) => set("minYear", e.target.value)}
              />
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Max Yıl"
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
                value={value.minKm ?? ""}
                onChange={(e) => set("minKm", e.target.value)}
              />
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Max KM"
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
              value={value.minM2 ?? ""}
              onChange={(e) => set("minM2", e.target.value)}
            />
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Max m²"
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
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            checked
                              ? "border-primary bg-primary text-primary-fg"
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
        <Button className="h-11 w-full text-sm font-semibold" onClick={onApply}>
          Filtreleri Uygula
        </Button>
      ) : null}
    </aside>
  );
}
