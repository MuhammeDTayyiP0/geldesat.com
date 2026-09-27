import { TURKEY_CITIES } from "@/lib/data/locations";
import { NEIGHBORHOODS } from "@/lib/data/geo";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AttrDef } from "@/lib/server/helpers";

export type FilterState = {
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
  attrs: Record<string, string[]>;
};

export function Filters({
  value,
  onChange,
  onApply,
  attributes = [],
  hideApplyButton = false,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  onApply: () => void;
  attributes?: AttrDef[];
  hideApplyButton?: boolean;
}) {
  const city = TURKEY_CITIES.find((c) => c.name === value.city);
  const districts = city?.districts ?? [];
  const hoods = (value.city && value.district && NEIGHBORHOODS[value.city]?.[value.district]) || [];
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
        <Label>İl</Label>
        <Select
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
        <Label>İlçe</Label>
        <Select
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
      {hoods.length > 0 ? (
        <div>
          <Label>Mahalle</Label>
          <Select value={value.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value || undefined)}>
            <option value="">Tüm mahalleler</option>
            {hoods.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div>
        <Label>Fiyat (TL)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" placeholder="Min" value={value.minPrice ?? ""} onChange={(e) => set("minPrice", e.target.value)} />
          <Input type="number" placeholder="Max" value={value.maxPrice ?? ""} onChange={(e) => set("maxPrice", e.target.value)} />
        </div>
      </div>
      {hasVehicle ? (
        <>
          <div>
            <Label>Yıl</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Min" value={value.minYear ?? ""} onChange={(e) => set("minYear", e.target.value)} />
              <Input type="number" placeholder="Max" value={value.maxYear ?? ""} onChange={(e) => set("maxYear", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>KM</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Min" value={value.minKm ?? ""} onChange={(e) => set("minKm", e.target.value)} />
              <Input type="number" placeholder="Max" value={value.maxKm ?? ""} onChange={(e) => set("maxKm", e.target.value)} />
            </div>
          </div>
        </>
      ) : null}
      {hasM2 ? (
        <div>
          <Label>m²</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Min" value={value.minM2 ?? ""} onChange={(e) => set("minM2", e.target.value)} />
            <Input type="number" placeholder="Max" value={value.maxM2 ?? ""} onChange={(e) => set("maxM2", e.target.value)} />
          </div>
        </div>
      ) : null}
      {attributes.filter((a) => a.type === "SELECT").length > 0 ? (
        <details open className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Özellikler</summary>
          <div className="mt-3 max-h-80 space-y-3 overflow-auto">
            {attributes
              .filter((a) => a.type === "SELECT")
              .map((a) => (
                <div key={a.id}>
                  <Label>{a.name}</Label>
                  <div className="max-h-32 space-y-1 overflow-auto text-sm">
                    {(a.options ?? []).map((opt) => {
                      const checked = (value.attrs[a.name] ?? []).includes(opt);
                      return (
                        <label key={opt} className="flex min-h-9 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleAttr(a.name, opt, e.target.checked)}
                          />
                          {opt}
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
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Donanım / iç-dış özellik</summary>
          <div className="mt-3 max-h-80 space-y-3 overflow-auto">
            {attributes
              .filter((a) => a.type === "MULTI")
              .map((a) => (
                <div key={a.id}>
                  <Label>{a.name}</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(a.options ?? []).map((opt) => {
                      const checked = (value.attrs[a.name] ?? []).includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          className={`rounded-full border px-2 py-1 text-xs ${checked ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
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
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Evet / Hayır</summary>
          <div className="mt-3 space-y-1 text-sm">
            {attributes
              .filter((a) => a.type === "BOOLEAN")
              .map((a) => {
                const opt = (a.options ?? ["Evet"])[0];
                const checked = (value.attrs[a.name] ?? []).includes(opt);
                return (
                  <label key={a.id} className="flex min-h-9 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleAttr(a.name, opt, e.target.checked)}
                    />
                    {a.name}
                  </label>
                );
              })}
          </div>
        </details>
      ) : null}
      <div>
        <Label>Sıralama</Label>
        <Select value={value.sort ?? "date_desc"} onChange={(e) => set("sort", e.target.value)}>
          <option value="date_desc">Yeniden eskiye</option>
          <option value="date_asc">Eskiden yeniye</option>
          <option value="price_asc">Fiyat artan</option>
          <option value="price_desc">Fiyat azalan</option>
          <option value="views_desc">En çok görüntülenen</option>
        </Select>
      </div>
      {!hideApplyButton ? (
        <Button className="w-full" onClick={onApply}>
          Filtrele
        </Button>
      ) : null}
    </aside>
  );
}
