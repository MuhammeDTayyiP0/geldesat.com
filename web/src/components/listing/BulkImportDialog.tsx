import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { bulkImportListings } from "@/lib/server/account";
import { errorText } from "@/lib/error-text";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";

type BulkRow = {
  title: string;
  description: string;
  price: number;
  currency: "TRY" | "USD" | "EUR";
  categorySlug: string;
  city: string;
  district: string;
  neighborhood?: string;
};

type ParseResult = {
  rows: BulkRow[];
  error: string | null;
};

function normalizeCurrency(raw: string | undefined): "TRY" | "USD" | "EUR" {
  const upper = (raw ?? "").trim().toUpperCase();
  if (upper === "USD" || upper === "$") return "USD";
  if (upper === "EUR" || upper === "€") return "EUR";
  return "TRY";
}

function normalizePrice(raw: string | undefined): number {
  const cleaned = (raw ?? "").replace(/[\s_₺$€]|TL/gi, "").trim();
  if (!cleaned) return Number.NaN;
  let normalized = cleaned;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    normalized = cleaned.replace(/,/g, "");
  } else if (/^\d+(,\d{1,2})$/.test(cleaned)) {
    normalized = cleaned.replace(",", ".");
  } else if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return Number.NaN;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

function normalizeHeaderKey(header: string): keyof BulkRow | null {
  const k = header
    .trim()
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[\s-]+/g, "_");
  if (k === "title" || k === "baslik" || k === "ilan_basligi") return "title";
  if (k === "description" || k === "aciklama") return "description";
  if (k === "price" || k === "fiyat") return "price";
  if (k === "currency" || k === "para_birimi" || k === "doviz") return "currency";
  if (k === "categoryslug" || k === "category_slug" || k === "category" || k === "kategori" || k === "kategori_slug") {
    return "categorySlug";
  }
  if (k === "city" || k === "sehir" || k === "il") return "city";
  if (k === "district" || k === "ilce") return "district";
  if (k === "neighborhood" || k === "mahalle") return "neighborhood";
  return null;
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        cur += ch;
      }
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      if (cur.trim()) lines.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) lines.push(cur);
  return lines;
}

function splitCsvFields(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function rowFromRecord(record: Partial<Record<keyof BulkRow, string>>): BulkRow {
  const neighborhood = record.neighborhood?.trim();
  return {
    title: (record.title ?? "").trim(),
    description: (record.description ?? "").trim(),
    price: normalizePrice(record.price),
    currency: normalizeCurrency(record.currency),
    categorySlug: (record.categorySlug ?? "").trim(),
    city: (record.city ?? "").trim(),
    district: (record.district ?? "").trim(),
    ...(neighborhood ? { neighborhood } : {}),
  };
}

function parseCsvBulk(text: string): ParseResult {
  const lines = splitCsvLines(text.replace(/^\uFEFF/, ""));
  if (lines.length < 2) {
    return { rows: [], error: "CSV en az bir başlık satırı ve bir veri satırı içermelidir." };
  }
  const headerLine = lines[0];
  const delimiter = headerLine.split(";").length > headerLine.split(",").length ? ";" : ",";
  const headers = splitCsvFields(headerLine, delimiter).map(normalizeHeaderKey);
  if (!headers.some(Boolean)) {
    return {
      rows: [],
      error: "Geçerli sütun başlıkları bulunamadı (title, description, price, currency, categorySlug, city, district, neighborhood).",
    };
  }
  const rows: BulkRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvFields(lines[i], delimiter);
    const rec: Partial<Record<keyof BulkRow, string>> = {};
    headers.forEach((key, idx) => {
      if (key && cols[idx] !== undefined) rec[key] = cols[idx];
    });
    rows.push(rowFromRecord(rec));
  }
  return { rows, error: null };
}

function parseXmlBulk(text: string): ParseResult {
  if (typeof DOMParser === "undefined") return { rows: [], error: "XML ayrıştırıcı kullanılamıyor." };
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    return { rows: [], error: "XML sözdizimi hatalı. Etiketleri kontrol edin." };
  }
  const itemSelectors = ["listing", "ilan", "item", "row", "record"];
  let nodes: Element[] = [];
  for (const tag of itemSelectors) {
    const matched = Array.from(doc.getElementsByTagName(tag));
    if (matched.length) {
      nodes = matched;
      break;
    }
  }
  if (!nodes.length) {
    return { rows: [], error: "XML içinde <listing>, <ilan>, <item> veya <row> öğesi bulunamadı." };
  }
  const rows: BulkRow[] = nodes.map((node) => {
    const rec: Partial<Record<keyof BulkRow, string>> = {};
    for (const child of Array.from(node.children)) {
      const key = normalizeHeaderKey(child.tagName);
      if (key) rec[key] = child.textContent ?? "";
    }
    for (const attr of Array.from(node.attributes)) {
      const key = normalizeHeaderKey(attr.name);
      if (key && !rec[key]) rec[key] = attr.value;
    }
    return rowFromRecord(rec);
  });
  return { rows, error: null };
}

function parseBulkInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { rows: [], error: null };
  return trimmed.startsWith("<") ? parseXmlBulk(trimmed) : parseCsvBulk(trimmed);
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}) {
  const [rawImport, setRawImport] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: Array<{ index: number; error: string }> } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const parsedImport = useMemo(() => parseBulkInput(rawImport), [rawImport]);

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      setRawImport(text);
      setImportResult(null);
    } catch {
      toast.error("Dosya okunamadı");
    }
  }

  async function onBulkImport() {
    if (!parsedImport.rows.length || parsedImport.rows.length > 50) return;
    setImportBusy(true);
    setImportResult(null);
    try {
      const res = await bulkImportListings({ data: { rows: parsedImport.rows } });
      setImportResult(res);
      if (res.imported > 0) {
        toast.success(`${res.imported} ilan başarıyla aktarıldı`);
        onImported?.();
      } else if (res.errors.length > 0) {
        toast.error("Hiçbir ilan aktarılamadı, satır hatalarını kontrol edin.");
      }
    } catch (err) {
      toast.error(errorText(err, "Toplu aktarım başarısız"));
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !importBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-surface">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> Toplu İlan Aktarımı (CSV / XML)
          </DialogTitle>
          <DialogDescription>
            Tek seferde en fazla 50 ilan yükleyebilirsiniz. Sütunlar:{" "}
            <code className="rounded bg-elevated px-1 py-0.5 text-[11px]">
              title, description, price, currency, categorySlug, city, district, neighborhood
            </code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,.xml,text/csv,application/xml,text/xml"
              className="hidden"
              onChange={(e) => {
                void onImportFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={importBusy}
              onClick={() => importFileRef.current?.click()}
            >
              <Upload className="size-4" /> Dosya seç
            </Button>
          </div>

          <div>
            <Label htmlFor="bulk-import-raw">CSV veya XML içeriği</Label>
            <Textarea
              id="bulk-import-raw"
              value={rawImport}
              onChange={(e) => {
                setRawImport(e.target.value);
                setImportResult(null);
              }}
              placeholder={
                "title,description,price,currency,categorySlug,city,district,neighborhood\nTemiz 2020 Sedan,Garaj arabası bakımlı araç,850000,TRY,otomobil,İstanbul,Kadıköy,Moda"
              }
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          {parsedImport.error ? (
            <p className="rounded-lg border border-danger-solid/30 bg-danger-solid/8 px-3 py-2 text-xs text-danger">
              {parsedImport.error}
            </p>
          ) : null}

          {parsedImport.rows.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-fg">Önizleme: {parsedImport.rows.length} satır algılandı</span>
                {parsedImport.rows.length > 50 ? (
                  <span className="font-medium text-danger">
                    Tek seferde en fazla 50 ilan aktarılabilir ({parsedImport.rows.length}/50)
                  </span>
                ) : null}
              </div>
              <ul className="divide-y divide-border text-xs">
                {parsedImport.rows.slice(0, 5).map((row, idx) => (
                  <li key={`${idx}-${row.title}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-medium text-fg">
                      {idx + 1}. {row.title || "(Başlık yok)"}
                    </span>
                    <span className="text-muted">
                      {formatPrice(row.price, row.currency)} · {row.categorySlug || "?"} · {row.city || "?"}/{row.district || "?"}
                    </span>
                  </li>
                ))}
              </ul>
              {parsedImport.rows.length > 5 ? (
                <p className="text-[11px] text-muted">ve {parsedImport.rows.length - 5} satır daha…</p>
              ) : null}
            </div>
          ) : null}

          {importResult ? (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-3 text-xs">
              <p className="font-semibold text-fg">
                Aktarım sonucu: {importResult.imported} ilan yüklendi
                {importResult.errors.length ? `, ${importResult.errors.length} satırda hata` : "."}
              </p>
              {importResult.errors.length ? (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-danger">
                  {importResult.errors.map((err) => (
                    <li key={`${err.index}-${err.error}`}>
                      Satır {err.index + 1}: {err.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" disabled={importBusy} onClick={() => onOpenChange(false)}>
              Kapat
            </Button>
            <Button
              type="button"
              disabled={importBusy || parsedImport.rows.length === 0 || parsedImport.rows.length > 50}
              onClick={() => void onBulkImport()}
            >
              {importBusy ? "Aktarılıyor…" : `${parsedImport.rows.length || 0} ilanı içe aktar`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
